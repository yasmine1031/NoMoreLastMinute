const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');

let particles = [];
let animationId = null;
let isZenMode = false;
let particleTheme = 'default';
let particlePalette = 'cool';

const mouse = {
    x: null,
    y: null,
    radius: 150,
    enabled: true,
};

const audioState = {
    bass: 0,
    treble: 0,
    intensity: 0,
    breath: 0,
    hue: 210,
};

let audioContext = null;
let audioAnalyser = null;
let audioSource = null;
let audioDataArray = null;
let audioFrameId = null;

const BASE_HUE = 210;
const ZEN_HUE_SPREAD = 140;
const GHOST_TRAIL_ALPHA = 0.14;
const NORMAL_TRAIL_ALPHA = 0.06;
const MAX_PARTICLES = 180;

window.addEventListener('mousemove', (event) => {
    if (!mouse.enabled) return;
    mouse.x = event.clientX;
    mouse.y = event.clientY;
});

window.addEventListener('resize', () => {
    init();
});

window.addEventListener('mouseout', () => {
    mouse.x = null;
    mouse.y = null;
});

class Particle {
    constructor(x, y, vx, vy, size, hue, saturation) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.baseVx = vx;
        this.baseVy = vy;
        this.baseSize = size;
        this.size = size;
        this.hue = hue;
        this.saturation = saturation;
        this.lightness = 68;
        this.alpha = 0.92;
        this.offset = Math.random() * Math.PI * 2;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        ctx.shadowBlur = 15;
        ctx.shadowColor = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, ${this.alpha})`;
        ctx.fillStyle = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, ${this.alpha})`;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    applyMouseAttraction() {
        if (!mouse.enabled || mouse.x === null || mouse.y === null) {
            const relax = 0.01;
            this.vx += (this.baseVx - this.vx) * relax;
            this.vy += (this.baseVy - this.vy) * relax;
            return;
        }

        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < mouse.radius) {
            const normalized = 1 - distance / mouse.radius;
            const attraction = normalized * normalized * 0.18;
            const angle = Math.atan2(dy, dx);
            this.vx += Math.cos(angle) * attraction;
            this.vy += Math.sin(angle) * attraction;
        } else {
            const relax = 0.01;
            this.vx += (this.baseVx - this.vx) * relax;
            this.vy += (this.baseVy - this.vy) * relax;
        }
    }

    applyZenAudioMotion() {
        const bass = audioState.bass;
        const treble = audioState.treble;
        const intensity = audioState.intensity;
        const breath = 0.5 + 0.5 * Math.sin(Date.now() * 0.0025 + this.offset) * bass;

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const dx = this.x - centerX;
        const dy = this.y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        const radialForce = (bass * 0.9 + breath * 0.15) * (distance / Math.max(centerX, centerY));
        this.vx += (dx / distance) * radialForce * 0.2;
        this.vy += (dy / distance) * radialForce * 0.2;

        const tremor = 0.08 + treble * 0.22;
        this.vx += (Math.random() - 0.5) * tremor;
        this.vy += (Math.random() - 0.5) * tremor;

        const speedLimit = 1.8 + bass * 3.2;
        this.vx = Math.sign(this.vx) * Math.min(Math.abs(this.vx), speedLimit);
        this.vy = Math.sign(this.vy) * Math.min(Math.abs(this.vy), speedLimit);

        const sizeBoost = 1 + bass * 0.75 + breath * 0.18;
        this.size = Math.max(0.9, this.baseSize * sizeBoost);
        this.hue = (BASE_HUE + treble * ZEN_HUE_SPREAD + this.offset * 4) % 360;
        this.lightness = 52 + treble * 18;
        this.alpha = 0.84 + intensity * 0.16;
    }

    update() {
        if (isZenMode) {
            this.applyZenAudioMotion();
        } else {
            this.applyMouseAttraction();
            this.hue = 210;
            this.saturation = 95;
            this.lightness = 78;
            this.alpha = 0.88;
            this.size = Math.max(0.9, this.baseSize);
        }

        this.x += this.vx;
        this.y += this.vy;

        if (this.x > canvas.width + 20) this.x = -20;
        if (this.x < -20) this.x = canvas.width + 20;
        if (this.y > canvas.height + 20) this.y = -20;
        if (this.y < -20) this.y = canvas.height + 20;

        this.draw();
    }
}

function init() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    particles = [];
    const count = Math.min(MAX_PARTICLES, Math.max(110, Math.round((canvas.width * canvas.height) / 16000)));
    for (let i = 0; i < count; i++) {
        const size = 1 + Math.random() * 2.4;
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const vx = (Math.random() - 0.5) * 0.8;
        const vy = (Math.random() - 0.5) * 0.8;
        const hue = particleTheme === 'zen' ? BASE_HUE + Math.random() * 45 : 210;
        const saturation = particleTheme === 'zen' ? 92 : 78;
        particles.push(new Particle(x, y, vx, vy, size, hue, saturation));
    }
}

function renderBackground() {
    if (!canvas) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = isZenMode
        ? 'rgba(10, 10, 12, 0.08)'
        : 'rgba(5, 14, 35, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function connectParticles() {
    const threshold = 90;
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < threshold) {
                const alpha = (1 - distance / threshold) * (0.18 + audioState.intensity * 0.28);
                const hue = isZenMode
                    ? (BASE_HUE + audioState.treble * ZEN_HUE_SPREAD) % 360
                    : 210;
                ctx.strokeStyle = `hsla(${hue}, 95%, 72%, ${alpha})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
}

function animate() {
    if (!canvas || !ctx) return;
    renderBackground();
    particles.forEach((p) => p.update());
    if (isZenMode) connectParticles();
    animationId = requestAnimationFrame(animate);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function smooth(prev, next, factor = 0.16) {
    return prev * (1 - factor) + next * factor;
}

function startAudioAnalyzer() {
    const audio = document.getElementById('zenAudio');
    if (!audio) return;

    if (!audioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
    }

    if (!audioSource) {
        try {
            audioSource = audioContext.createMediaElementSource(audio);
            audioAnalyser = audioContext.createAnalyser();
            audioAnalyser.fftSize = 256;
            audioSource.connect(audioAnalyser);
            audioSource.connect(audioContext.destination);
            audioDataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
        } catch (error) {
            console.warn('[particleEngine] Audio analyzer initialization failed:', error);
            return;
        }
    }

    function updateAudioState() {
        if (!audioAnalyser) return;
        audioAnalyser.getByteFrequencyData(audioDataArray);

        const bassBins = Array.from(audioDataArray).slice(0, 10);
        const trebleBins = Array.from(audioDataArray).slice(40);
        const bassEnergy = bassBins.reduce((sum, v) => sum + v, 0) / (bassBins.length || 1) / 255;
        const trebleEnergy = trebleBins.reduce((sum, v) => sum + v, 0) / (trebleBins.length || 1) / 255;
        const overallEnergy = Array.from(audioDataArray).reduce((sum, v) => sum + v, 0) / (audioDataArray.length * 255);

        audioState.bass = clamp(smooth(audioState.bass, bassEnergy), 0, 1);
        audioState.treble = clamp(smooth(audioState.treble, trebleEnergy), 0, 1);
        audioState.intensity = clamp(smooth(audioState.intensity, overallEnergy), 0, 1);
        audioState.breath = clamp(smooth(audioState.breath, Math.sin(Date.now() * 0.002) * 0.5 + 0.5 * bassEnergy), 0, 1);
        audioState.hue = (BASE_HUE + audioState.treble * ZEN_HUE_SPREAD) % 360;

        audioFrameId = requestAnimationFrame(updateAudioState);
    }

    if (!audioFrameId) {
        audioFrameId = requestAnimationFrame(updateAudioState);
    }
}

function stopAudioAnalyzer() {
    if (audioFrameId) {
        cancelAnimationFrame(audioFrameId);
        audioFrameId = null;
    }
    audioState.bass = 0;
    audioState.treble = 0;
    audioState.intensity = 0;
    audioState.breath = 0;
    audioState.hue = BASE_HUE;
}

function setZenMode(active) {
    isZenMode = Boolean(active);
    mouse.enabled = !isZenMode;
    particleTheme = isZenMode ? 'zen' : 'default';
    particlePalette = isZenMode ? 'zen' : 'cool';
    if (isZenMode) {
        startAudioAnalyzer();
    } else {
        stopAudioAnalyzer();
    }
    init();
}

function setParticleTheme(theme) {
    particleTheme = theme;
    init();
}

function setParticleAudioIntensity(value) {
    audioState.intensity = clamp(value, 0, 1);
}

window.particleEngine = {
    setZenMode,
    init,
    start: () => {
        if (!animationId) animate();
    },
    stop: () => {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    },
};

init();
animate();
