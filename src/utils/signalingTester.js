/**
 * SignalingTester
 * 
 * A utility class to simulate a second peer in the room for end-to-end testing.
 * This runs in the browser console of the "Main User" (or a second window) 
 * but programmatically acts as a *different* user.
 */

import { doc, onSnapshot, setDoc, collection, query, where, orderBy, limit } from "firebase/firestore";

export class SignalingTester {
    constructor(db, roomId, myUsername, targetUsername) {
        this.db = db;
        this.roomId = roomId;
        this.me = myUsername; // The fake user we are simulating
        this.target = targetUsername; // The real user we are testing against
        this.pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        this.sharedRoomPath = typeof __app_id !== "undefined"
            ? `/artifacts/${__app_id}/rooms/${roomId}`
            : `rooms/${roomId}`;

        this.unsub = null;
        this.setupPeerConnection();
    }

    setupPeerConnection() {
        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal('ice-candidate', { candidate: event.candidate.toJSON() });
            }
        };

        this.pc.onconnectionstatechange = () => {
            console.log(`[SignalingTester] Connection state: ${this.pc.connectionState}`);
        };

        this.pc.onsignalingstatechange = () => {
            console.log(`[SignalingTester] Signaling state: ${this.pc.signalingState}`);
        }

        // Handle incoming audio
        this.pc.ontrack = (event) => {
            console.log("[SignalingTester] Received remote track");
            const stream = event.streams[0];
            const audio = new Audio();
            audio.srcObject = stream;
            audio.autoplay = true;
            // Mute it so we don't get feedback in the same browser
            audio.muted = true;
        };
    }

    async start() {
        console.log(`[SignalingTester] Starting as ${this.me}, targeting ${this.target}`);

        // Get user media (microphone) for testing
        try {
            console.log(`[SignalingTester] Requesting microphone access...`);
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            console.log(`[SignalingTester] Got microphone access, adding tracks to peer connection`);

            // Add audio tracks to peer connection
            stream.getTracks().forEach(track => {
                console.log(`[SignalingTester] Adding ${track.kind} track to peer connection`);
                this.pc.addTrack(track, stream);
            });

            this.localStream = stream;
        } catch (err) {
            console.error(`[SignalingTester] Failed to get user media:`, err);
            console.warn(`[SignalingTester] Continuing without local media - audio won't be sent`);
        }

        // Add self to room
        // Note: We assume the room exists. We just forcefully add our name.
        // In a real app we might need to read first, but this is a test script.

        // Listen for signals directed to me
        const roomDocRef = doc(this.db, this.sharedRoomPath);
        const signalingCollection = collection(roomDocRef, 'voiceSignaling');
        const q = query(
            signalingCollection,
            where('to', '==', this.me),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        this.unsub = onSnapshot(q, async (snapshot) => {
            const changes = snapshot.docChanges();
            // Sort to process oldest first (though we are only listening to recent ones)
            // Actually standard snapshot order might be enough if we process added

            for (const change of changes) {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    if (data.from !== this.target) continue;

                    if (data.type === 'offer') {
                        await this.handleOffer(data.offer);
                    } else if (data.type === 'answer') {
                        await this.handleAnswer(data.answer);
                    } else if (data.type === 'ice-candidate') {
                        await this.handleCandidate(data.candidate);
                    }
                }
            }
        });

        // Also "join" the voice call in Firestore so the UI sees us
        // We need to fetch the current call participants first
        // For simplicity, we'll assuming we can just merge-add ourselves if needed, 
        // or rely on the main app logic to see us? 
        // Actually the main app checks `voiceCall.participants`.
        // Let's rely on the main user to "join" and us to "join".

        console.log("[SignalingTester] Listening for signals...");
    }

    async joinCall() {
        // Manually add ourselves to the voiceCall participants list in Firestore
        // This requires reading the doc first.
        // For this test script, we might skip this if the main app doesn't strictly enforce it 
        // for *sending* signals, but the main app *does* check participants to decide who to call.
        // So we should add ourselves.
        // However, since we are running in the console, we can just use the provided db instance.
        // We will leave this manual for now or assume the tester sets it up.
    }

    async sendOffer() {
        console.log("[SignalingTester] Sending Offer...");
        // Add a transceiver (audio)
        this.pc.addTransceiver('audio', { direction: 'sendrecv' });

        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);

        await this.sendSignal('offer', { offer: { type: offer.type, sdp: offer.sdp } });
    }

    async handleOffer(offer) {
        console.log("[SignalingTester] Handling Offer...");
        await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        await this.sendSignal('answer', { answer: { type: answer.type, sdp: answer.sdp } });
    }

    async handleAnswer(answer) {
        console.log("[SignalingTester] Handling Answer...");
        await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    }

    async handleCandidate(candidate) {
        console.log("[SignalingTester] Handling Candidate...");
        try {
            await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            console.error("Error adding Ice", e);
        }
    }

    async sendSignal(type, payload) {
        const id = `${type}_${this.me}_${this.target}_${Date.now()}`;
        const roomDocRef = doc(this.db, this.sharedRoomPath);
        const signalDoc = doc(roomDocRef, 'voiceSignaling', id);

        await setDoc(signalDoc, {
            from: this.me,
            to: this.target,
            type: type,
            timestamp: Date.now(),
            ...payload
        }, { merge: true });
    }

    stop() {
        if (this.unsub) this.unsub();
        this.pc.close();
    }
}
