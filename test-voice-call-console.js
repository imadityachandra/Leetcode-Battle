/**
 * Voice Call Console Tester
 * 
 * This script can be run in the browser console of your main app
 * to simulate a second user and test the voice call flow.
 * 
 * Usage:
 * 1. Open your app in the browser
 * 2. Join a room with your main username
 * 3. Open the browser console (F12)
 * 4. Copy and paste this entire script
 * 5. Run: testVoiceCall('your_main_username', 'test_user', 'room_id')
 */

async function testVoiceCall(mainUsername, testUsername, roomId) {
    console.log('='.repeat(60));
    console.log('🎤 VOICE CALL END-TO-END TEST');
    console.log('='.repeat(60));
    console.log(`Main User: ${mainUsername}`);
    console.log(`Test User: ${testUsername}`);
    console.log(`Room ID: ${roomId}`);
    console.log('='.repeat(60));

    // Check if Firebase is available
    if (!window.db) {
        console.error('❌ Firebase not found. Make sure the app is loaded.');
        return;
    }

    if (!window.SignalingTester) {
        console.error('❌ SignalingTester not found. Make sure it\'s imported in App.jsx');
        return;
    }

    const db = window.db;
    const SignalingTester = window.SignalingTester;

    console.log('✅ Firebase and SignalingTester found');

    // Create tester instance
    const tester = new SignalingTester(db, roomId, testUsername, mainUsername);

    console.log('✅ SignalingTester instance created');
    console.log('📡 Starting to listen for signals...');

    // Start listening
    await tester.start();

    console.log('✅ Now listening for voice call signals');
    console.log('');
    console.log('📋 NEXT STEPS:');
    console.log('1. In the main app UI, click "Start Voice Call"');
    console.log('2. Watch the console for connection events');
    console.log('3. Check the connection states below:');
    console.log('');

    // Monitor connection state
    const monitorInterval = setInterval(() => {
        const pc = tester.pc;
        if (pc) {
            console.log('📊 Connection Status:');
            console.log(`   - Connection State: ${pc.connectionState}`);
            console.log(`   - Signaling State: ${pc.signalingState}`);
            console.log(`   - ICE Connection State: ${pc.iceConnectionState}`);
            console.log(`   - ICE Gathering State: ${pc.iceGatheringState}`);

            // Check if connected
            if (pc.connectionState === 'connected') {
                console.log('🎉 SUCCESS! Peer connection established!');
                console.log('');
                console.log('✅ Audio flow test PASSED');
                console.log('');
                console.log('To stop the test, run: tester.stop()');
                clearInterval(monitorInterval);
            } else if (pc.connectionState === 'failed') {
                console.error('❌ FAILED! Peer connection failed');
                console.error('');
                console.error('Possible issues:');
                console.error('1. Firewall blocking WebRTC');
                console.error('2. STUN servers not reachable');
                console.error('3. Signaling messages not being exchanged');
                clearInterval(monitorInterval);
            }
        }
    }, 3000);

    // Store tester globally for manual control
    window.voiceCallTester = tester;
    window.stopVoiceCallTest = () => {
        clearInterval(monitorInterval);
        tester.stop();
        console.log('🛑 Test stopped');
    };

    console.log('');
    console.log('💡 TIP: The tester is stored in window.voiceCallTester');
    console.log('💡 To stop: window.stopVoiceCallTest()');
    console.log('');
}

// Quick test function with defaults
async function quickTest() {
    // Try to get room ID from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room') || localStorage.getItem('lb_currentRoom') || 'test_room';
    const mainUsername = localStorage.getItem('lb_leetcodeUsername') || 'user1';
    const testUsername = 'testuser';

    console.log('🚀 Running quick test with detected values...');
    await testVoiceCall(mainUsername, testUsername, roomId);
}

// Diagnostic function
function diagnoseVoiceCall() {
    console.log('='.repeat(60));
    console.log('🔍 VOICE CALL DIAGNOSTICS');
    console.log('='.repeat(60));

    // Check Firebase
    if (window.db) {
        console.log('✅ Firebase: Connected');
    } else {
        console.error('❌ Firebase: Not found');
    }

    // Check SignalingTester
    if (window.SignalingTester) {
        console.log('✅ SignalingTester: Available');
    } else {
        console.error('❌ SignalingTester: Not found');
    }

    // Check WebRTC support
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        console.log('✅ WebRTC: Supported');
    } else {
        console.error('❌ WebRTC: Not supported');
    }

    // Check microphone permission
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            console.log('✅ Microphone: Permission granted');
            stream.getTracks().forEach(track => track.stop());
        })
        .catch(err => {
            console.error('❌ Microphone: Permission denied or not available');
            console.error('   Error:', err.message);
        });

    // Check current room
    const roomId = localStorage.getItem('lb_currentRoom');
    if (roomId) {
        console.log(`✅ Current Room: ${roomId}`);
    } else {
        console.warn('⚠️ No room selected');
    }

    // Check current username
    const username = localStorage.getItem('lb_leetcodeUsername');
    if (username) {
        console.log(`✅ Current User: ${username}`);
    } else {
        console.warn('⚠️ No username set');
    }

    console.log('='.repeat(60));
    console.log('');
    console.log('💡 To run a quick test: quickTest()');
    console.log('💡 To run custom test: testVoiceCall(mainUser, testUser, roomId)');
}

// Export functions
console.log('✅ Voice Call Test Script Loaded');
console.log('');
console.log('Available functions:');
console.log('  - diagnoseVoiceCall()  : Check if everything is set up correctly');
console.log('  - quickTest()          : Run test with auto-detected values');
console.log('  - testVoiceCall(main, test, room) : Run custom test');
console.log('');
console.log('👉 Start by running: diagnoseVoiceCall()');
