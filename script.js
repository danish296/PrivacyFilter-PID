// --- SPA Navigation and Auth ---
function isLoggedIn() {
    // Simple check: you can improve this with real auth
    return !!localStorage.getItem('userToken');
}

function showContent(page) {
    if (!isLoggedIn() && page !== 'login' && page !== 'register' && page !== 'home') {
        alert('Please log in to access this section.');
        showLogin();
        return;
    }
    document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`${page}-page`).classList.remove('hidden');
}
function showLogin() {
    document.getElementById('logout-link').style.display = 'none';
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('register-container').classList.add('hidden');
    document.getElementById('main-content').classList.add('hidden');
}
function showRegister() {
    document.getElementById('logout-link').style.display = 'none';
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('register-container').classList.remove('hidden');
    document.getElementById('main-content').classList.add('hidden');
}
function showMain() {
    document.getElementById('logout-link').style.display = 'block';
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('register-container').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');
    showContent('home');
    // Show user ID if available
    const userId = localStorage.getItem('userId');
    const userIdDisplay = document.getElementById('user-id-display');
    if (userId && userIdDisplay) {
        userIdDisplay.textContent = 'Your Unique ID: ' + userId;
        userIdDisplay.style.display = 'block';
    } else if (userIdDisplay) {
        userIdDisplay.style.display = 'none';
    }
}
document.getElementById('login-form').onsubmit = async function(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const loginMsg = document.getElementById('login-message');
    loginMsg.classList.add('hidden');
    loginMsg.textContent = '';

    try {
        const response = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const result = await response.json();
        if (response.ok && result.user && result.user.userId) {
            localStorage.setItem('userToken', result.token);
            localStorage.setItem('userId', result.user.userId);
            showMain();
        } else {
            loginMsg.textContent = result.message || 'Login failed';
            loginMsg.classList.remove('hidden');
        }
    } catch (err) {
        loginMsg.textContent = 'Network error. Please try again.';
        loginMsg.classList.remove('hidden');
    }
};
document.getElementById('register-form').onsubmit = async function(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const registerMsg = document.getElementById('register-message');
    registerMsg.classList.add('hidden');
    registerMsg.textContent = '';

    try {
        const response = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const result = await response.json();
        if (response.ok) {
            registerMsg.classList.remove('hidden');
            registerMsg.classList.remove('text-red-500');
            registerMsg.classList.add('text-green-600');
            registerMsg.textContent = 'Registration successful! Your User ID is: ' + (result.userId || 'N/A') + '. Please log in.';
            setTimeout(() => {
                showLogin();
                registerMsg.classList.add('hidden');
                registerMsg.classList.remove('text-green-600');
                registerMsg.classList.add('text-red-500');
            }, 2000);
        } else {
            registerMsg.textContent = result.message || 'Registration failed';
            registerMsg.classList.remove('hidden');
        }
    } catch (err) {
        registerMsg.textContent = 'Network error. Please try again.';
        registerMsg.classList.remove('hidden');
    }
};
document.getElementById('logout-link').onclick = function(e) {
    e.preventDefault();
    localStorage.removeItem('userToken');
    localStorage.removeItem('userId');
    showLogin();
};
window.showRegister = showRegister;
window.showLogin = showLogin;
window.showContent = showContent;


// --- Socket.io and WebRTC Peer-to-Peer Calls by User ID ---

const socket = io('http://localhost:5000'); // Adjust backend URL
let yourId = null;
let peerConnection = null;
let localStream = null;
let remoteStream = null;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startBtn = document.getElementById('start-local-video-btn');
const callInput = document.getElementById('call-to-id-input');
const callBtn = document.getElementById('call-btn');
const usersListEl = document.getElementById('users-list');
const yourIdDisplay = document.getElementById('your-id-display');

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

socket.on('your-id', id => {
    yourId = id;
    yourIdDisplay.textContent = `Your ID: ${id}`;
});

socket.on('users-list', users => {
    usersListEl.innerHTML = '';
    users.forEach(userId => {
        const li = document.createElement('li');
        li.textContent = userId;
        usersListEl.appendChild(li);
    });
});

startBtn.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    startBtn.disabled = true;
    callBtn.disabled = false;
};

callBtn.onclick = async () => {
    const userToCall = callInput.value.trim();
    if (!userToCall) {
        alert('Please enter user ID to call');
        return;
    }
    createPeerConnection(userToCall);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('call-user', {
        userToCall,
        signalData: offer
    });
};

socket.on('incoming-call', async (data) => {
    if (!peerConnection) createPeerConnection(data.from);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer-call', {
        signalData: answer,
        to: data.from
    });
});

socket.on('call-accepted', async (data) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
});

socket.on('ice-candidate', async (data) => {
    if (data.candidate) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
            console.error('Error adding ICE candidate', err);
        }
    }
});

function createPeerConnection(remoteId) {
    peerConnection = new RTCPeerConnection(configuration);
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('ice-candidate', { candidate: event.candidate, to: remoteId });
        }
    };
    peerConnection.ontrack = event => {
        if (!remoteStream) {
            remoteStream = new MediaStream();
            remoteVideo.srcObject = remoteStream;
        }
        remoteStream.addTrack(event.track);
    };
}


// --- Demo Video Face Blur and Download ---

// --- History Page: Show 'No history data' by default ---
window.addEventListener('DOMContentLoaded', function() {
    var historyPage = document.getElementById('history-page');
    if (historyPage) {
        var historyList = document.getElementById('history-list');
        if (historyList) {
            historyList.innerHTML = '<div class="text-gray-500 text-center">No history data</div>';
        }
    }
});

let demoFaceModel, demoBlurAnimId, demoMediaRecorder, demoRecordedChunks = [];

const videoInput = document.getElementById('video-upload');
const demoVideo = document.getElementById('demo-video');
const demoCanvas = document.getElementById('demo-canvas');
const startBlurBtn = document.getElementById('start-blur-btn');
const stopBlurBtn = document.getElementById('stop-blur-btn');
const downloadBlurBtn = document.getElementById('download-blur-btn');

videoInput.onchange = function() {
    const file = videoInput.files[0];
    if (file) {
        demoVideo.src = URL.createObjectURL(file);
        startBlurBtn.disabled = false;
        stopBlurBtn.disabled = true;
        downloadBlurBtn.disabled = true;
    }
};

async function loadDemoFaceModel() {
    if (!demoFaceModel) {
        demoFaceModel = await blazeface.load();
    }
}

startBlurBtn.onclick = async function() {
    await loadDemoFaceModel();
    demoCanvas.width = demoVideo.videoWidth;
    demoCanvas.height = demoVideo.videoHeight;
    demoCanvas.style.display = 'block';
    stopBlurBtn.disabled = false;
    startBlurBtn.disabled = true;
    downloadBlurBtn.disabled = true;
    demoRecordedChunks = [];

    const stream = demoCanvas.captureStream();
    demoMediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    demoMediaRecorder.ondataavailable = function(e) {
        if (e.data.size > 0) demoRecordedChunks.push(e.data);
    };
    demoMediaRecorder.onstop = function() {
        if (demoRecordedChunks.length > 0) {
            downloadBlurBtn.disabled = false;
        }
    };
    demoMediaRecorder.start();

    blurDemoFrame();
};

stopBlurBtn.onclick = function() {
    cancelAnimationFrame(demoBlurAnimId);
    demoCanvas.getContext('2d').clearRect(0, 0, demoCanvas.width, demoCanvas.height);
    demoCanvas.style.display = 'none';
    startBlurBtn.disabled = false;
    stopBlurBtn.disabled = true;
    if (demoMediaRecorder && demoMediaRecorder.state !== "inactive") {
        demoMediaRecorder.stop();
    }
};

downloadBlurBtn.onclick = function() {
    const blob = new Blob(demoRecordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blurred_video.webm';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
};

async function blurDemoFrame() {
    if (demoVideo.paused || demoVideo.ended) {
        demoBlurAnimId = requestAnimationFrame(blurDemoFrame);
        return;
    }
    const ctx = demoCanvas.getContext('2d');
    ctx.drawImage(demoVideo, 0, 0, demoCanvas.width, demoCanvas.height);

    const predictions = await demoFaceModel.estimateFaces(demoVideo, false);

    if (predictions.length > 0) {
        let largest = predictions[0];
        let largestArea = (largest.bottomRight[0] - largest.topLeft[0]) * (largest.bottomRight[1] - largest.topLeft[1]);
        for (let i = 1; i < predictions.length; i++) {
            let area = (predictions[i].bottomRight[0] - predictions[i].topLeft[0]) * (predictions[i].bottomRight[1] - predictions[i].topLeft[1]);
            if (area > largestArea) {
                largest = predictions[i];
                largestArea = area;
            }
        }
        for (const pred of predictions) {
            if (pred === largest) continue;
            const [x1, y1] = pred.topLeft;
            const [x2, y2] = pred.bottomRight;
            const w = x2 - x1;
            const h = y2 - y1;
            const faceImage = ctx.getImageData(x1, y1, w, h);
            const offCanvas = document.createElement('canvas');
            offCanvas.width = w;
            offCanvas.height = h;
            const offCtx = offCanvas.getContext('2d');
            offCtx.putImageData(faceImage, 0, 0);
            offCtx.filter = 'blur(12px)';
            offCtx.drawImage(offCanvas, 0, 0);
            ctx.drawImage(offCanvas, 0, 0, w, h, x1, y1, w, h);
        }
    }
    demoBlurAnimId = requestAnimationFrame(blurDemoFrame);
}

// --- Chat, vulnerability, and history JS code can be added here similarly unchanged from previous messages ---















document.getElementById('video-upload-form').onsubmit = async function(e) {
  e.preventDefault();
  const fileInput = document.getElementById('video-upload');
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('video', file);

  const response = await fetch('http://localhost:5000/api/upload', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  alert(result.message);
  // Optionally, handle the returned filename or processed video
};