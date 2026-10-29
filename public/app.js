// 1. FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyC4knZfgfVG68rjYNtU2FiUoDSXGbE-jQQ",
    authDomain: "human-text-studio.firebaseapp.com",
    databaseURL: "https://human-text-studio-default-rtdb.firebaseio.com",
    projectId: "human-text-studio",
    storageBucket: "human-text-studio.firebasestorage.app",
    messagingSenderId: "367375171731",
    appId: "1:367375171731:web:a61d1d86d63ef2a5"
};

// Initialize Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Database reference
const database = firebase.database();

// 2. DIRECT GLOBAL GOOGLE AUTH CLICK HANDLER
window.handleGoogleAuth = async function () {
    console.log("⚡ Google Auth Triggered!");
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await firebase.auth().signInWithPopup(provider);
        console.log("Logged in user:", result.user.email);
        alert(`Welcome ${result.user.displayName || result.user.email}!`);
        closeModal();
    } catch (error) {
        console.error("Google Auth Error:", error);
        alert("Google Login Error: " + error.message);
    }
};

function closeModal() {
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.style.display = 'none';
}

function openModal() {
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.style.display = 'flex';
}

// Function to fetch and display user generation history
function loadUserHistory(userId) {
    const historyContainer = document.getElementById('historyContainer');
    const historyList = document.getElementById('historyList');

    if (!historyContainer || !historyList) return;

    const historyRef = database.ref('history/' + userId);
    historyRef.on('value', (snapshot) => {
        historyList.innerHTML = '';
        const data = snapshot.val();

        if (data) {
            historyContainer.style.display = 'block';
            const items = Object.values(data).reverse(); // Latest first

            items.forEach((item, index) => {
                const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                const card = document.createElement('div');
                card.style.cssText = 'background: #1e1e2d; border: 1px solid #2d2d3f; border-radius: 8px; padding: 14px; color: #e0e0e0;';

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.85rem; color: #888;">
                        <span>Refined Entry #${items.length - index}</span>
                        <span>${dateStr}</span>
                    </div>
                    <p style="font-size: 0.95rem; line-height: 1.5; color: #d0d0e0; margin-bottom: 10px;">${item.refinedText}</p>
                    <button class="btn-secondary copy-hist-btn" style="padding: 4px 10px; font-size: 0.8rem;" data-text="${encodeURIComponent(item.refinedText)}">Copy</button>
                `;
                historyList.appendChild(card);
            });

            // Attach copy listeners
            document.querySelectorAll('.copy-hist-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const text = decodeURIComponent(e.target.getAttribute('data-text'));
                    navigator.clipboard.writeText(text);
                    e.target.innerText = 'Copied!';
                    setTimeout(() => { e.target.innerText = 'Copy'; }, 2000);
                });
            });
        } else {
            historyContainer.style.display = 'none';
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Human Text Studio App Initialized!");

    const auth = firebase.auth();

    // DOM Elements
    const inputText = document.getElementById('inputText');
    const resultText = document.getElementById('resultText');
    const charCounter = document.getElementById('charCounter');
    const refineBtn = document.getElementById('refineBtn');
    const copyBtn = document.getElementById('copyBtn');

    const loginNavBtn = document.getElementById('loginNavBtn');
    const signupNavBtn = document.getElementById('signupNavBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const authForm = document.getElementById('authForm');
    const userCreditsDisplay = document.getElementById('userCreditsDisplay');
    const tryFreeBtn = document.getElementById('tryFreeBtn');

    const MAX_WORDS = 500;

    // Helper functions
    function getWordCount(text) {
        const trimmed = text.trim();
        if (!trimmed) return 0;
        return trimmed.split(/\s+/).filter(w => w.length > 0).length;
    }

    function truncateToMaxWords(text, maxWords) {
        const words = text.trim().split(/\s+/);
        if (words.length > maxWords) {
            return words.slice(0, maxWords).join(' ');
        }
        return text;
    }

    // Modal Control
    if (loginNavBtn) loginNavBtn.addEventListener('click', openModal);
    if (signupNavBtn) signupNavBtn.addEventListener('click', openModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

    document.querySelectorAll('.modal-trigger').forEach(btn => {
        btn.addEventListener('click', openModal);
    });

    if (tryFreeBtn) {
        tryFreeBtn.addEventListener('click', () => {
            const appSection = document.getElementById('app');
            if (appSection) appSection.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // Email/Password Submit Handler
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('authEmail').value;
            const password = document.getElementById('authPassword').value;

            try {
                await auth.signInWithEmailAndPassword(email, password);
                closeModal();
            } catch (error) {
                if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                    try {
                        await auth.createUserWithEmailAndPassword(email, password);
                        alert("Account created successfully!");
                        closeModal();
                    } catch (signUpError) {
                        alert("Sign up Error: " + signUpError.message);
                    }
                } else {
                    alert("Error: " + error.message);
                }
            }
        });
    }

    // Monitor Auth State Changes
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log("Active Session:", user.email);
            if (loginNavBtn) {
                loginNavBtn.innerText = user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0];
                loginNavBtn.onclick = () => {
                    if (confirm("Logout from Human Text Studio?")) {
                        auth.signOut();
                    }
                };
            }
            if (signupNavBtn) signupNavBtn.style.display = 'none';
            if (userCreditsDisplay) {
                userCreditsDisplay.innerHTML = `<span class="credit-pill">Pro Active</span> ${user.email}`;
            }

            // Load user's saved generation history
            loadUserHistory(user.uid);

        } else {
            if (loginNavBtn) {
                loginNavBtn.innerText = 'Log In';
                loginNavBtn.onclick = openModal;
            }
            if (signupNavBtn) signupNavBtn.style.display = 'inline-block';
            if (userCreditsDisplay) {
                userCreditsDisplay.innerHTML = `<span class="credit-pill">Free Tier</span> 3 / 3 Daily Uses Left`;
            }

            const historyContainer = document.getElementById('historyContainer');
            if (historyContainer) historyContainer.style.display = 'none';
        }
    });

    // Word Counter
    if (inputText) {
        inputText.addEventListener('input', () => {
            let text = inputText.value;
            let currentWords = getWordCount(text);

            if (currentWords > MAX_WORDS) {
                inputText.value = truncateToMaxWords(text, MAX_WORDS);
                currentWords = MAX_WORDS;
                alert(`Maximum limit is ${MAX_WORDS} words!`);
            }

            if (charCounter) {
                charCounter.innerText = `${currentWords} / ${MAX_WORDS} words`;
            }
        });

        inputText.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const currentText = inputText.value;
            const combinedText = currentText ? `${currentText} ${pastedText}` : pastedText;
            const words = combinedText.trim().split(/\s+/).filter(w => w.length > 0);

            if (words.length > MAX_WORDS) {
                inputText.value = words.slice(0, MAX_WORDS).join(' ');
                alert(`Pasted text trimmed to fit 500-word limit.`);
            } else {
                inputText.value = combinedText;
            }

            inputText.dispatchEvent(new Event('input'));
        });
    }

    // Refine Text Button
    if (refineBtn) {
        refineBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const text = inputText ? inputText.value.trim() : '';

            if (!text) {
                alert('Please enter some text to refine!');
                return;
            }

            refineBtn.innerText = 'Refining... ⏳';
            refineBtn.disabled = true;
            if (resultText) resultText.value = 'Refining via LLaMA engine... Please wait.';

            try {
                const response = await fetch('/api/humanize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text,
                        tone: (document.getElementById('tone') || {}).value || 'natural',
                        targetLanguage: (document.getElementById('targetLanguage') || {}).value.trim()
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to process request');
                }

                if (resultText) {
                    resultText.value = data.result || 'No output returned.';

                    // Save history to Realtime Database if user is logged in
                    const currentUser = auth.currentUser;
                    if (currentUser && data.result) {
                        const historyRef = database.ref('history/' + currentUser.uid);
                        historyRef.push({
                            email: currentUser.email,
                            originalText: text,
                            refinedText: data.result,
                            timestamp: Date.now()
                        }).then(() => {
                            console.log("Saved to Realtime Database successfully!");
                        }).catch(err => {
                            console.error("Database save error:", err);
                        });
                    }
                }

            } catch (err) {
                console.error('Refine Error:', err);
                if (resultText) resultText.value = 'Error: ' + err.message;
            } finally {
                refineBtn.innerHTML = '<span>Refine Text</span> <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
                refineBtn.disabled = false;
            }
        });
    }

    // Copy Button
    if (copyBtn && resultText) {
        copyBtn.addEventListener('click', () => {
            if (!resultText.value) return;
            navigator.clipboard.writeText(resultText.value);
            copyBtn.innerText = 'Copied!';
            setTimeout(() => { copyBtn.innerText = 'Copy Output'; }, 2000);
        });
    }
});
