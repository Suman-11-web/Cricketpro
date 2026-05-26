// --- PWA SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/sw.js');
    });
}

// --- SIDEBAR MENU LOGIC ---
const menuBtn = document.getElementById('menu-btn');
const closeMenuBtn = document.getElementById('close-menu-btn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');

function openMenu() {
    sidebar.classList.add('open');
    overlay.classList.add('open');
    if(navigator.vibrate) navigator.vibrate(15);
}

function closeMenu() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
    if(navigator.vibrate) navigator.vibrate(10);
}

menuBtn.addEventListener('click', openMenu);
closeMenuBtn.addEventListener('click', closeMenu);
overlay.addEventListener('click', closeMenu);

// --- GSAP INTRO ---
window.addEventListener("load", () => {
    gsap.from(".top-header", {y: -50, opacity: 0, duration: 1, ease: "power3.out"});
    gsap.from(".card", {y: 50, opacity: 0, duration: 1, stagger: 0.2, ease: "back.out(1.2)", clearProps: "all"});
    gsap.from(".bottom-nav", {y: 100, opacity: 0, duration: 1.2, delay: 0.5, ease: "power4.out"});
});

function switchTab(tabName) {
    if(navigator.vibrate) navigator.vibrate(20); 
    
    ['home', 'schedule', 'teams', 'history'].forEach(tab => {
        document.getElementById('tab-' + tab).classList.remove('active-tab');
        document.getElementById('nav-' + tab).classList.remove('active');
    });
    
    document.getElementById('tab-' + tabName).classList.add('active-tab');
    document.getElementById('nav-' + tabName).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
    
    localStorage.setItem('activeHCLTab', tabName);

    gsap.from(`#tab-${tabName} .gs-reveal, #tab-${tabName} .card`, {
        y: 30, opacity: 0, duration: 0.6, stagger: 0.1, ease: "power3.out", clearProps: "all"
    });
}

let lastRuns = -1;
let lastWickets = -1;

function showAnimation(text, color) {
    const animBox = document.getElementById('action-anim');
    animBox.innerText = text;
    animBox.style.color = color;
    animBox.style.textShadow = `0 0 60px ${color}, 0 0 20px ${color}`;
    animBox.classList.remove('anim-active');
    void animBox.offsetWidth; 
    animBox.classList.add('anim-active');
    if(navigator.vibrate) navigator.vibrate([100, 50, 100]); 
}

async function fetchLiveScore() {
    try {
        const response = await fetch('/api/match-data'); 
        const data = await response.json();
        
        if (lastRuns !== -1) {
            let rDiff = data.runs - lastRuns;
            let wDiff = data.wickets - lastWickets;
            
            if (rDiff > 0 || wDiff > 0) {
                let targetId = data.batting_team === data.team_a ? '#score-a' : '#score-b';
                gsap.fromTo(targetId, 
                    { scale: 1.3, textShadow: `0 0 30px ${data.batting_color || "#A3E635"}`, y: -10 }, 
                    { scale: 1, textShadow: "none", y: 0, duration: 0.8, ease: "elastic.out(1, 0.4)" }
                );
            }

            if (wDiff > 0) showAnimation("OUT!", "#EF4444"); 
            else if (rDiff === 6) showAnimation("SIX!", data.batting_color || "#A3E635"); 
            else if (rDiff === 4) showAnimation("FOUR!", "#3B82F6"); 
        }
        lastRuns = data.runs;
        lastWickets = data.wickets;

        ['logo-a', 'logo-b'].forEach(id => {
            let el = document.getElementById(id);
            el.style.background = ""; el.style.borderColor = ""; el.style.color = "white"; el.style.boxShadow = "";
            el.style.transform = "scale(1)";
        });
        document.getElementById('team-a-name').style.textShadow = "none";
        document.getElementById('team-a-name').style.color = "var(--text-muted)";
        document.getElementById('team-b-name').style.textShadow = "none";
        document.getElementById('team-b-name').style.color = "var(--text-muted)";
        
        document.getElementById('match-title').innerText = data.title;
        document.getElementById('toss').innerText = data.toss;
        document.getElementById('venue').innerText = data.venue;
        
        document.getElementById('team-a-name').innerText = data.team_a;
        document.getElementById('team-b-name').innerText = data.team_b;
        document.getElementById('logo-a').innerText = data.team_a.substring(0,2);
        document.getElementById('logo-b').innerText = data.team_b.substring(0,2);
        
        let liveBadge = document.getElementById('live-badge-ui');
        if (data.title === "MATCH COMPLETED") {
            liveBadge.style.background = "rgba(255,255,255,0.05)";
            liveBadge.style.borderColor = "rgba(255,255,255,0.2)";
            liveBadge.style.color = "var(--text-muted)";
            liveBadge.style.boxShadow = "none";
            liveBadge.style.textShadow = "none";
            liveBadge.innerHTML = `<i class="fa-solid fa-flag-checkered"></i> COMPLETED`;
        } else {
            liveBadge.style.background = "rgba(239, 68, 68, 0.15)";
            liveBadge.style.borderColor = "rgba(239, 68, 68, 0.5)";
            liveBadge.style.color = "#FCA5A5";
            liveBadge.style.boxShadow = "0 0 20px rgba(239,68,68,0.2)";
            liveBadge.innerHTML = `<span class="dot-blink"></span> LIVE`;
        }
        
        document.getElementById('target').innerText = data.target;

        const bColor = data.batting_color || "#A3E635";
        const currentScore = data.runs + '/' + data.wickets;
        const prevScoreText = (data.prev_runs !== undefined && data.target > 0) ? (data.prev_runs + '/' + data.prev_wickets) : (data.target > 0 ? (data.target - 1) : "Yet to bat");

        const updateTeamUI = (team, isBatting, bColor, score, overs, status) => {
            let nameEl = document.getElementById(`team-${team}-name`);
            let boxEl = document.getElementById(`score-box-${team}`);
            let scoreEl = document.getElementById(`score-${team}`);
            let oversEl = document.getElementById(`overs-${team}`);
            let oversTextEl = document.getElementById(`overs-text-${team}`);
            let statusEl = document.getElementById(`status-${team}`);

            if (isBatting) {
                nameEl.style.color = bColor;
                nameEl.style.textShadow = `0 0 15px ${bColor}80`;
                boxEl.style.display = "block";
                statusEl.style.display = "none";
                scoreEl.innerText = score;
                scoreEl.style.color = bColor;
                oversEl.innerText = overs;
                oversTextEl.style.color = bColor;
            } else {
                nameEl.style.color = "var(--text-muted)";
                nameEl.style.textShadow = "none";
                boxEl.style.display = "none";
                statusEl.style.display = "block";
                statusEl.innerText = status;
                
                if (data.target > 0) {
                    statusEl.style.color = "white"; 
                    statusEl.style.fontSize = "1.6rem"; 
                    statusEl.style.fontWeight = "900";
                    statusEl.style.fontStyle = "normal";
                } else {
                    statusEl.style.color = "var(--text-muted)";
                    statusEl.style.fontSize = "0.9rem";
                    statusEl.style.fontWeight = "600";
                    statusEl.style.fontStyle = "italic";
                }
            }
        };

        if(data.batting_team === data.team_a) {
            updateTeamUI('a', true, bColor, currentScore, data.overs, prevScoreText);
            updateTeamUI('b', false, bColor, currentScore, data.overs, prevScoreText);
        } else {
            updateTeamUI('b', true, bColor, currentScore, data.overs, prevScoreText);
            updateTeamUI('a', false, bColor, currentScore, data.overs, prevScoreText);
        }

        let overs_split = data.overs.split('.');
        let total_balls = (parseInt(overs_split[0]) * 6) + (parseInt(overs_split[1]) || 0);
        document.getElementById('crr').innerText = total_balls > 0 ? (data.runs / (total_balls / 6)).toFixed(2) : "0.00";

        let timelineHTML = data.recent_balls.length === 0 ? '<span style="color:var(--text-muted); font-size:0.85rem;">WAITING...</span>' : "";
        data.recent_balls.forEach(ball => {
            let ballClass = "ball-circle" + (ball === "W" ? " ball-w" : (ball === "4" || ball === "6" ? " ball-bound" : ""));
            timelineHTML += `<div class="${ballClass}">${ball}</div>`;
        });
        document.getElementById('ball-timeline').innerHTML = timelineHTML;

        const eqBox = document.getElementById('equation-box');
        let match_total_overs = data.total_overs || 20; 
        let max_balls = match_total_overs * 6;
        let balls_left = max_balls - total_balls;

        if (data.title === "MATCH COMPLETED") {
            eqBox.style.display = "block";
            eqBox.style.color = bColor;
            let winner = "";

            if (data.target > 0) {
                let runs_to_win = data.target - data.runs;
                if (runs_to_win <= 0) {
                    let wickets_left = 10 - data.wickets;
                    document.getElementById('equation').innerText = `${data.batting_team} WON BY ${wickets_left} WICKETS! 🏆`;
                    winner = data.batting_team; 
                } else {
                    let win_margin = (data.target - 1) - data.runs;
                    if (win_margin === 0) {
                        document.getElementById('equation').innerText = `MATCH TIED! 🤝`;
                        winner = "TIE";
                    } else {
                        let bowling_team = (data.batting_team === data.team_a) ? data.team_b : data.team_a;
                        document.getElementById('equation').innerText = `${bowling_team} WON BY ${win_margin} RUNS! 🏆`;
                        winner = bowling_team; 
                    }
                }
            } else {
                document.getElementById('equation').innerText = `MATCH COMPLETED 🏆`;
            }

            // PREMIUM GLASS CROWN EFFECT
            const goldColor = "#FFD700";
            const goldGlow = "0 10px 30px rgba(255, 215, 0, 0.4)";
            
            const makeWinner = (teamId, nameId) => {
                let logo = document.getElementById(teamId);
                logo.innerHTML = "👑";
                logo.style.background = "linear-gradient(135deg, rgba(255,215,0,0.3), rgba(255,215,0,0.05))";
                logo.style.borderColor = "rgba(255,215,0,0.6)";
                logo.style.boxShadow = goldGlow + ", inset 0 2px 10px rgba(255,215,0,0.2)";
                logo.style.transform = "scale(1.1)";
                
                let name = document.getElementById(nameId);
                name.style.color = goldColor;
                name.style.textShadow = "0 0 15px rgba(255,215,0,0.5)";
            };

            if (winner === data.team_a) makeWinner('logo-a', 'team-a-name');
            else if (winner === data.team_b) makeWinner('logo-b', 'team-b-name');

            // --- 🎇 3D CONFETTI CELEBRATION ENGINE ---
            const matchId = data.title + data.team_a + data.team_b + data.runs; 
            if (localStorage.getItem('lastCelebrated') !== matchId) {
                var duration = 3 * 1000; // 3 seconds of continuous fireworks
                var animationEnd = Date.now() + duration;
                var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

                function randomInRange(min, max) { return Math.random() * (max - min) + min; }

                var interval = setInterval(function() {
                    var timeLeft = animationEnd - Date.now();
                    if (timeLeft <= 0) return clearInterval(interval);
                    var particleCount = 50 * (timeLeft / duration);
                    // Fires confetti from both the left and right sides of the screen
                    confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
                    confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
                }, 250);
                
                // Vibrate phone to the beat of the celebration
                if(navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
                
                localStorage.setItem('lastCelebrated', matchId);
            }

        } else if (data.target > 0) {
            let runs_needed = data.target - data.runs;
            eqBox.style.display = "block";
            eqBox.style.color = bColor;

            if (runs_needed <= 0) {
                document.getElementById('equation').innerText = `${data.batting_team} REACHED TARGET! (Click End Match) 🏆`;
            } else if (balls_left <= 0 || data.wickets >= 10) {
                document.getElementById('equation').innerText = `INNINGS OVER! Waiting for Admin...`;
            } else {
                document.getElementById('equation').innerText = `${data.batting_team} need ${runs_needed} runs in ${balls_left} balls`;
            }
        } else {
            if (balls_left <= 0 || data.wickets >= 10) {
                eqBox.style.display = "block";
                eqBox.style.color = bColor;
                document.getElementById('equation').innerText = `INNINGS OVER! Click Swap Innings.`;
            } else {
                eqBox.style.display = "none";
            }
        }
    } catch (error) {}
}

async function fetchUpcomingMatches() {
    try {
        const response = await fetch('/api/upcoming-matches');
        const matches = await response.json();
        let matchHTML = matches.length === 0 ? '<p style="text-align:center; color: var(--text-muted); margin-top: 10px;">No matches scheduled.</p>' : "";
        matches.forEach(m => {
            matchHTML += `<div style="display:flex; justify-content:space-between; align-items:center; text-align:center; margin-top:15px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:15px;"><div style="width:30%; font-size:0.85rem; font-weight:800;">${m.team_a}</div><div style="width:40%; font-size:0.8rem; color:var(--text-muted);"><i class="fa-regular fa-calendar" style="color:var(--neon-green)"></i> ${m.date}<br><span style="color:white; font-size:1rem; font-weight:bold;">${m.time}</span><br><span style="background:rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding:4px 10px; border-radius:12px; font-size:0.7rem; font-weight:bold; color:var(--text-muted);">VS</span></div><div style="width:30%; font-size:0.85rem; font-weight:800;">${m.team_b}</div></div>`;
        });
        document.getElementById('upcoming-matches-container').innerHTML = matchHTML;
        document.getElementById('upcoming-home-container').innerHTML = matchHTML;
    } catch (error) {}
}

async function fetchTables() {
    try {
        const resPts = await fetch('/api/points-table');
        const pts = await resPts.json();
        pts.sort((a, b) => b.pts - a.pts || parseFloat(b.nrr) - parseFloat(a.nrr));
        
        let ptsHTML = pts.length === 0 ? `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No data.</td></tr>` : "";
        pts.forEach((r, i) => ptsHTML += `<tr><td style="color:var(--text-muted);">${i+1}</td><td style="text-align:left; font-weight:800; color:white;">${r.team}</td><td>${r.p}</td><td>${r.w}</td><td>${r.l}</td><td style="color:var(--neon-green); font-weight:bold;">${r.nrr}</td><td style="color:white; font-weight:900; font-size:1.1rem;">${r.pts}</td></tr>`);
        document.getElementById('points-tbody').innerHTML = ptsHTML;

        const resTeams = await fetch('/api/teams');
        const teams = await resTeams.json();
        let teamsHTML = teams.length === 0 ? `<tr><td style="text-align:center; color:var(--text-muted);">No teams registered.</td></tr>` : "";
        teams.forEach((t, i) => teamsHTML += `<tr><td style="width:15%;"><div style="width:20px; height:20px; border-radius:50%; background:${t.color}; box-shadow:0 0 10px ${t.color}; margin:auto;"></div></td><td style="text-align:left; font-weight:800; color:var(--text-light); font-size:1rem;">${t.name}</td></tr>`);
        document.getElementById('teams-tbody').innerHTML = teamsHTML;
    } catch (error) {}
}

async function fetchHistory() {
    try {
        const response = await fetch('/api/completed-matches');
        const history = await response.json();
        let html = history.length === 0 ? '<p style="text-align:center; color: var(--text-muted); margin-top: 10px;">No completed matches yet.</p>' : "";
        
        history.forEach(m => {
            let isAWinner = m.winner === m.team_a;
            let isBWinner = m.winner === m.team_b;
            let scoreA = m.team_a_score ? `<div style="font-size:1.3rem; color:white; font-weight:900; margin-top:8px;">${m.team_a_score}</div>` : '';
            let scoreB = m.team_b_score ? `<div style="font-size:1.3rem; color:white; font-weight:900; margin-top:8px;">${m.team_b_score}</div>` : '';
            
            html += `<div style="margin-top:20px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:25px; text-align:center;">
                <div style="font-size:0.85rem; font-weight:700; color:var(--text-muted); margin-bottom:20px; background:rgba(0,0,0,0.4); display:inline-block; padding:6px 16px; border-radius:20px; border: 1px solid rgba(255,255,255,0.05);"><i class="fa-regular fa-calendar"></i> ${m.date}</div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="width:42%; font-weight:800; font-size:0.95rem; color: ${isAWinner ? '#FFD700' : 'var(--text-light)'}; text-shadow: ${isAWinner ? '0 0 15px rgba(255,215,0,0.4)' : 'none'}">
                        ${isAWinner ? '👑 ' : ''}${m.team_a} ${scoreA}
                    </div>
                    <div style="width:16%; font-size:0.75rem; font-weight:bold; color:var(--text-muted); background:rgba(255,255,255,0.05); backdrop-filter:blur(10px); padding:8px; border-radius:50%; border:1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 10px rgba(0,0,0,0.3);">VS</div>
                    <div style="width:42%; font-weight:800; font-size:0.95rem; color: ${isBWinner ? '#FFD700' : 'var(--text-light)'}; text-shadow: ${isBWinner ? '0 0 15px rgba(255,215,0,0.4)' : 'none'}">
                        ${m.team_b}${isBWinner ? ' 👑' : ''} ${scoreB}
                    </div>
                </div>
                <div style="margin-top:20px; font-size:0.95rem; color:var(--neon-green); font-weight:900; background: linear-gradient(90deg, rgba(163,230,53,0.05), rgba(163,230,53,0.15), rgba(163,230,53,0.05)); border: 1px solid rgba(163, 230, 53, 0.2); padding: 12px; border-radius: 12px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); text-transform: uppercase;">${m.result}</div>
            </div>`;
        });
        document.getElementById('history-container').innerHTML = html;
    } catch (error) {}
}

function updateAllData() { fetchLiveScore(); fetchUpcomingMatches(); fetchTables(); fetchHistory(); }

async function shareScorecard() {
    const card = document.getElementById('shareable-card');
    const shareBtn = card.querySelector('button');
    shareBtn.style.display = 'none';
    if(navigator.vibrate) navigator.vibrate(50);

    try {
        const canvas = await html2canvas(card, { backgroundColor: '#050505', scale: 2 });
        const imageBase64 = canvas.toDataURL("image/jpeg", 0.9);
        shareBtn.style.display = 'block';

        if (navigator.share) {
            const blob = await (await fetch(imageBase64)).blob();
            const file = new File([blob], 'HCL_Score.jpg', { type: 'image/jpeg' });
            await navigator.share({ title: 'HCL Live Score', text: 'Live match score! 🏏🔥', files: [file] });
        } else {
            const link = document.createElement('a');
            link.download = 'HCL_LiveScore.jpg'; link.href = imageBase64; link.click();
        }
    } catch (err) {
        shareBtn.style.display = 'block';
    }
}

const savedTab = localStorage.getItem('activeHCLTab') || 'home';
switchTab(savedTab);
updateAllData();

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
    socket.onmessage = function(event) { if (event.data === "UPDATE") updateAllData(); };
    socket.onclose = function() { setTimeout(() => { connectWebSocket(); }, 3000); };
}
connectWebSocket();
