import * as THREE from 'three'

// Shader code converted from Shadertoy with audio reactivity
const fragmentShader = `
uniform vec3 iResolution;
uniform float iTime;
uniform float iAudioLevel; // Audio level from melody1 analyzer
uniform float iAudioFrequency; // Frequency data from melody1 analyzer
uniform float iMelody2Level; // Audio level from melody2 (poly) analyzer
uniform float iMelody2Frequency; // Frequency data from melody2 (poly) analyzer
uniform float iMelody3Level; // Audio level from melody3 (drums) analyzer
uniform float iMelody3Frequency; // Frequency data from melody3 (drums) analyzer
uniform float iBPM; // BPM value for zoom scale control

// RGB to HSV conversion
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec3 c;
    
    // Create smooth pulsing time based on melody2 (poly) frequency - SLOWER
    float timePulse = iTime * 0.2 + iMelody2Frequency * 0.6; // Much slower base time + reduced frequency modulation
    float timeSmooth = iTime * 0.2 + sin(iMelody2Level * 3.14159) * 0.05; // Slower base time + reduced level pulsing
    
    // Combine both time effects for rich pulsing
    float l, z = timePulse + timeSmooth;
    
    // Create zoom effect based on melody3 (drums) - scale manipulation
    // BPM controls base zoom scale (0.3 to 2.0 range)
    float bpmScale = 0.3 + (iBPM - 60.0) / 140.0 * 1.7; // Map BPM 60-200 to 0.3-2.0
    bpmScale = clamp(bpmScale, 0.3, 2.0); // Ensure within range
    
    float zoomScale = bpmScale + iMelody3Level * 0.1; // BPM-based zoom + level modulation
    float zoomPulse = bpmScale + sin(iMelody3Frequency * 6.28) * 0.1; // BPM-based zoom + frequency pulsing
    float finalZoom = zoomScale * zoomPulse;
    
    for(int i = 0; i < 3; i++) {
        vec2 uv, p = gl_FragCoord.xy / iResolution.xy;
        uv = p;
        p -= 0.5;
        p.x *= iResolution.x / iResolution.y;
        
        // Apply zoom effect to coordinates
        p *= finalZoom;
        
        z += 0.02; // Much slower animation speed
        l = length(p);
        uv += p / l * (sin(z) + 1.0) * abs(sin(l * 4.0 - z - z)); // Reduced spatial frequency for slower, more visible effects
        c[i] = 0.01 / length(mod(uv, 1.0) - 0.5);
    }
    
    // Convert RGB to HSV for hue manipulation
    vec3 hsv = rgb2hsv(c / l);
    
    // Modify hue based on audio frequency (0-1 range) - MUCH MORE DRAMATIC
    hsv.x += iAudioFrequency * 5.0; // Shift hue based on frequency (4x more dramatic)
    hsv.x = mod(hsv.x, 1.0); // Keep hue in 0-1 range
    
    // Modify saturation based on audio level - MUCH MORE DRAMATIC
    hsv.y *= (1.0 + iAudioLevel * 5.0); // Boost saturation with audio (2.5x more dramatic)
    hsv.y = clamp(hsv.y, 0.0, 1.0); // Clamp saturation
    
    // Also modify brightness/value for even more dramatic effect
    hsv.z *= (1.0 + iAudioLevel * 5.0); // Boost brightness with audio
    hsv.z = clamp(hsv.z, 0.0, 1.0); // Clamp brightness
    
    // Convert back to RGB
    vec3 rgb = hsv2rgb(hsv);
    
    gl_FragColor = vec4(rgb, iTime);
}
`

const vertexShader = `
void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const audioVisualization = {
    scene: null,
    camera: null,
    renderer: null,
    plane: null,
    material: null,
    animationId: null,
    isAnimating: false,
    audioAnalyzers: null,

    initializeThreeJS() {
        console.log('Initializing Three.js scene...')

        // Get the container element
        const container = document.getElementById('threejs-container')
        if (!container) {
            console.error('Three.js container not found!')
            return
        }

        // Create scene
        this.scene = new THREE.Scene()

        // Create camera (orthographic for full-screen plane)
        const width = window.innerWidth
        const height = window.innerHeight
        this.camera = new THREE.OrthographicCamera(
            -width / 2, width / 2,
            height / 2, -height / 2,
            0.1, 1000
        )
        this.camera.position.z = 1
        this.camera.lookAt(0, 0, 0)

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.renderer.setSize(width, height)
        this.renderer.setPixelRatio(window.devicePixelRatio)
        container.appendChild(this.renderer.domElement)

        // Create shader material
        this.material = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                iResolution: { value: new THREE.Vector3(width, height, 1) },
                iTime: { value: 0.0 },
                iAudioLevel: { value: 0.0 }, // Audio level from melody1
                iAudioFrequency: { value: 0.0 }, // Frequency data from melody1
                iMelody2Level: { value: 0.0 }, // Audio level from melody2 (poly)
                iMelody2Frequency: { value: 0.0 }, // Frequency data from melody2 (poly)
                iMelody3Level: { value: 0.0 }, // Audio level from melody3 (drums)
                iMelody3Frequency: { value: 0.0 }, // Frequency data from melody3 (drums)
                iBPM: { value: 100.0 } // BPM for zoom scale control
            }
        })

        // Create plane geometry (full viewport)
        const planeGeometry = new THREE.PlaneGeometry(width * 2, height * 2)
        this.plane = new THREE.Mesh(planeGeometry, this.material)
        this.plane.position.set(0, 0, 0) // Ensure plane is centered at origin
        this.scene.add(this.plane)

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize())

        console.log('✓ Three.js scene initialized')
        console.log('✓ Shader material created')
        console.log('✓ Full-viewport plane added')
    },

    onWindowResize() {
        if (!this.renderer || !this.camera) return

        const width = window.innerWidth
        const height = window.innerHeight

        // Update camera
        this.camera.left = -width / 2
        this.camera.right = width / 2
        this.camera.top = height / 2
        this.camera.bottom = -height / 2
        this.camera.updateProjectionMatrix()

        // Update renderer
        this.renderer.setSize(width, height)

        // Update plane size
        this.plane.geometry.dispose()
        this.plane.geometry = new THREE.PlaneGeometry(width * 2, height * 2)
        this.plane.position.set(0, 0, 0) // Keep plane centered

        // Update shader uniforms
        this.material.uniforms.iResolution.value.set(width, height, 1)

        console.log('✓ Scene resized to:', width, 'x', height)
    },

    startAnimation() {
        if (this.isAnimating) return

        console.log('Starting Three.js animation loop...')
        this.isAnimating = true

        const animate = () => {
            if (!this.isAnimating) return

            // Update time uniform
            this.material.uniforms.iTime.value = performance.now() * 0.001

            // Update audio data for reactive visuals
            this.updateAudioData()

            // Render the scene
            this.renderer.render(this.scene, this.camera)

            this.animationId = requestAnimationFrame(animate)
        }

        animate()
        console.log('✓ Animation loop started')
    },

    stopAnimation() {
        if (!this.isAnimating) return

        console.log('Stopping Three.js animation...')
        this.isAnimating = false

        if (this.animationId) {
            cancelAnimationFrame(this.animationId)
            this.animationId = null
        }

        console.log('✓ Animation stopped')
    },

    // Create audio analyzers and connect to shader
    createAudioAnalyzers(pianoGain, bassGain, polyGain, drumGain) {
        console.log('Creating audio analyzers...')

        // Use the main Tone.js audio context instead of creating a new one
        const audioContext = pianoGain.context.rawContext || pianoGain.context

        // Create analyzer for melody1 (piano + bass combined) - harmonically related
        const melody1Analyzer = audioContext.createAnalyser()
        melody1Analyzer.fftSize = 256
        melody1Analyzer.smoothingTimeConstant = 0.8

        // Create a gain node to properly mix piano and bass for melody1
        const melody1Mixer = audioContext.createGain()
        melody1Mixer.gain.value = 0.5 // Reduce gain to prevent clipping when mixing two sources

        // Connect piano and bass to the mixer, then mixer to analyzer
        if (pianoGain) {
            pianoGain.connect(melody1Mixer)
            console.log('✓ Piano connected to melody1 mixer')
        }
        if (bassGain) {
            bassGain.connect(melody1Mixer)
            console.log('✓ Bass connected to melody1 mixer')
        }
        melody1Mixer.connect(melody1Analyzer)

        // Create analyzer for melody2 (poly/mellotron) - for time pulsing
        const melody2Analyzer = audioContext.createAnalyser()
        melody2Analyzer.fftSize = 256
        melody2Analyzer.smoothingTimeConstant = 0.9 // More smoothing for time effects

        // Connect poly to melody2 analyzer
        if (polyGain) {
            polyGain.connect(melody2Analyzer)
            console.log('✓ Poly connected to melody2 analyzer')
        }

        // Create analyzer for melody3 (drums) - for zoom effects
        const melody3Analyzer = audioContext.createAnalyser()
        melody3Analyzer.fftSize = 256
        melody3Analyzer.smoothingTimeConstant = 0.7 // Less smoothing for punchy drum effects

        // Connect drums to melody3 analyzer
        if (drumGain) {
            drumGain.connect(melody3Analyzer)
            console.log('✓ Drums connected to melody3 analyzer')
        }

        this.audioAnalyzers = {
            melody1: melody1Analyzer,
            melody2: melody2Analyzer,
            melody3: melody3Analyzer,
            melody1Mixer: melody1Mixer // Store mixer reference for reconnection
        }

        console.log('✓ Audio analyzers created with proper mixing')
        console.log('✓ Melody1 analyzer connected to piano and bass via mixer')
    },

    // Update shader with audio data
    updateAudioData() {
        if (!this.audioAnalyzers || !this.audioAnalyzers.melody1) return

        const analyzer = this.audioAnalyzers.melody1
        const bufferLength = analyzer.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        // Get frequency data
        analyzer.getByteFrequencyData(dataArray)

        // Calculate frequency data with more sensitivity
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i]
        }
        const averageFrequency = sum / bufferLength / 255.0 // Normalize to 0-1

        // Calculate audio level with more sensitivity and smoothing
        let levelSum = 0
        for (let i = 0; i < bufferLength; i++) {
            levelSum += dataArray[i]
        }
        let audioLevel = levelSum / bufferLength / 255.0 // Normalize to 0-1

        // Apply smoothing and boost sensitivity
        audioLevel = Math.pow(audioLevel, 0.5) // Square root for more sensitivity to low levels
        audioLevel = Math.min(audioLevel * 2.0, 1.0) // Boost and clamp

        // Process melody2 (poly) for time pulsing effects
        let melody2Level = 0.0
        let melody2Frequency = 0.0

        if (this.audioAnalyzers.melody2) {
            const melody2Analyzer = this.audioAnalyzers.melody2
            const melody2BufferLength = melody2Analyzer.frequencyBinCount
            const melody2DataArray = new Uint8Array(melody2BufferLength)

            // Get frequency data from melody2
            melody2Analyzer.getByteFrequencyData(melody2DataArray)

            // Calculate melody2 frequency
            let melody2Sum = 0
            for (let i = 0; i < melody2BufferLength; i++) {
                melody2Sum += melody2DataArray[i]
            }
            melody2Frequency = melody2Sum / melody2BufferLength / 255.0

            // Calculate melody2 level
            let melody2LevelSum = 0
            for (let i = 0; i < melody2BufferLength; i++) {
                melody2LevelSum += melody2DataArray[i]
            }
            melody2Level = melody2LevelSum / melody2BufferLength / 255.0

            // Apply smoothing for time effects
            melody2Level = Math.pow(melody2Level, 0.7) // Less aggressive for smooth pulsing
            melody2Frequency = Math.pow(melody2Frequency, 0.8) // Smooth frequency changes
        }

        // Process melody3 (drums) for zoom effects
        let melody3Level = 0.0
        let melody3Frequency = 0.0

        if (this.audioAnalyzers.melody3) {
            const melody3Analyzer = this.audioAnalyzers.melody3
            const melody3BufferLength = melody3Analyzer.frequencyBinCount
            const melody3DataArray = new Uint8Array(melody3BufferLength)

            // Get frequency data from melody3
            melody3Analyzer.getByteFrequencyData(melody3DataArray)

            // Calculate melody3 frequency
            let melody3Sum = 0
            for (let i = 0; i < melody3BufferLength; i++) {
                melody3Sum += melody3DataArray[i]
            }
            melody3Frequency = melody3Sum / melody3BufferLength / 255.0

            // Calculate melody3 level
            let melody3LevelSum = 0
            for (let i = 0; i < melody3BufferLength; i++) {
                melody3LevelSum += melody3DataArray[i]
            }
            melody3Level = melody3LevelSum / melody3BufferLength / 255.0

            // Apply punchy processing for drum effects
            melody3Level = Math.pow(melody3Level, 0.6) // More aggressive for punchy zoom
            melody3Frequency = Math.pow(melody3Frequency, 0.7) // Responsive frequency changes
        }

        // Update shader uniforms
        this.material.uniforms.iAudioLevel.value = audioLevel
        this.material.uniforms.iAudioFrequency.value = averageFrequency
        this.material.uniforms.iMelody2Level.value = melody2Level
        this.material.uniforms.iMelody2Frequency.value = melody2Frequency
        this.material.uniforms.iMelody3Level.value = melody3Level
        this.material.uniforms.iMelody3Frequency.value = melody3Frequency

        // Log audio data for debugging
        if (Math.random() < 0.05) { // Log more frequently to see changes
            console.log('🎵 Audio Reactivity:', {
                melody1: {
                    level: audioLevel.toFixed(3),
                    frequency: averageFrequency.toFixed(3)
                },
                melody2: {
                    level: melody2Level.toFixed(3),
                    frequency: melody2Frequency.toFixed(3),
                    timePulse: (melody2Frequency * 2.0).toFixed(3),
                    smoothPulse: (Math.sin(melody2Level * 3.14159) * 0.5).toFixed(3)
                },
                melody3: {
                    level: melody3Level.toFixed(3),
                    frequency: melody3Frequency.toFixed(3),
                    zoomScale: (1.0 + melody3Level * 0.5).toFixed(3),
                    zoomPulse: (1.0 + Math.sin(melody3Frequency * 6.28) * 0.3).toFixed(3)
                }
            })
        }
    },

    // Update BPM in shader
    updateBPM(bpm) {
        if (this.material && this.material.uniforms.iBPM) {
            this.material.uniforms.iBPM.value = bpm
            console.log(`🎵 BPM updated in shader: ${bpm}`)
        }
    }
}
