import * as THREE from 'three';
import * as Tone from 'tone';

// Three.js Audio-Reactive Visualization
export class AudioVisualization {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.audioReactiveSquare = null;
        this.audioAnalyzers = {
            melody1: null, // Piano + Bass combined
            melody2: null, // Poly
            melody3: null  // Drums
        };
        this.audioData = {
            melody1: { frequency: 0, volume: 0 },
            melody2: { frequency: 0, volume: 0 },
            melody3: { frequency: 0, volume: 0 }
        };
        this.visualizationInitialized = false;
        this.animationId = null;
    }

    // Initialize Three.js scene
    initializeThreeJS() {
        if (this.visualizationInitialized) return;

        console.log('Initializing Three.js audio-reactive visualization...');

        // Get container element
        const container = document.getElementById('threejs-container');
        if (!container) {
            console.error('Three.js container not found');
            return;
        }

        console.log('Container found:', container);
        console.log('Container size:', container.clientWidth, 'x', container.clientHeight);

        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000011);

        console.log('Three.js scene created with background color:', this.scene.background);

        // Create camera (will be set to orthographic in createAudioReactiveSquare)
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        this.camera.position.z = 1;

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);

        // Create audio-reactive square
        this.createAudioReactiveSquare();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());

        this.visualizationInitialized = true;
        console.log('✅ Three.js visualization initialized');
    }

    // Create the audio-reactive shader plane
    createAudioReactiveSquare() {
        // Create full-screen plane geometry
        const geometry = new THREE.PlaneGeometry(2, 2);

        // Load shader files
        const vertexShader = `
            void main() {
                gl_Position = vec4(position, 1.0);
            }
        `;

        const fragmentShader = `
            uniform float uTime;
            uniform vec2 uResolution;
            uniform float uMelody1; // Piano+Bass - affects color hue
            uniform float uMelody2; // Poly - affects scale/size
            uniform float uMelody3; // Drums - affects rotation speed

            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            void main() {
                vec2 resolution = uResolution;
                float time = uTime;
                float vertexCount = 2000.0;
                
                gl_FragColor = vec4(0);
                
                float down = floor(sqrt(vertexCount));
                float across = floor(vertexCount / down);
                
                // Compute NDC and unscaled position
                vec2 ndc = (gl_FragCoord.xy / resolution) * 2.0 - 1.0;
                vec2 pos = ndc / 1.3;
                
                // Approximate u and v including average offset influence
                float u_approx = (pos.x + 1.0) / 2.0;
                float v_approx = (pos.y + 1.0) / 2.0;
                
                // Approximate grid indices
                float xa = u_approx * (across - 1.0);
                float ya = v_approx * (down - 1.0);
                
                // Search radius based on max offset errors (x: ~2.2, y: ~4.3 grid units)
                const int radius_x = 3;
                const int radius_y = 5;
                
                int x_start = max(0, int(floor(xa)) - radius_x);
                int x_end = min(int(across - 1.0), int(ceil(xa)) + radius_x);
                int y_start = max(0, int(floor(ya)) - radius_y);
                int y_end = min(int(down), int(ceil(ya)) + radius_y); // Cap at potential max y
                
                for (int ix = x_start; ix <= x_end; ++ix) {
                    for (int jy = y_start; jy <= y_end; ++jy) {
                        float x = float(ix);
                        float y = float(jy);
                        
                        // Validate vertex existence
                        float vertexId = y * across + x;
                        if (vertexId >= vertexCount) continue;
                        
                        float u = x / (across - 1.0);
                        float v = y / (down - 1.0);
                        
                        // Audio-reactive rotation speed control (Melody 3 - Drums)
                        float xoff = sin(time * (1.0 + uMelody3 * 2.0) + y * 0.2) * 0.1;
                        float yoff = sin(time * 1.1 * (1.0 + uMelody3 * 2.0) + x * 0.3) * 0.2;
                        
                        float ux = u * 2.0 - 1.0 + xoff;
                        float vy = v * 2.0 - 1.0 + yoff;
                        
                        vec2 xy = vec2(ux, vy) * 1.3;
                        
                        // Screen space center
                        vec2 center = (xy * 0.5 + 0.5) * resolution;
                        
                        float soff = sin(time * 1.2 + x * y * 0.02) * 5.0;
                        
                        // Audio-reactive scale control (Melody 2 - Poly)
                        float pointSize = (15.0 + soff) * (1.0 + uMelody2 * 2.0);
                        pointSize *= 20.0 / across;
                        pointSize *= resolution.x / 600.0;
                        
                        float halfSize = pointSize / 2.0;
                        
                        // Check if fragment is within the square point
                        if (abs(gl_FragCoord.x - center.x) < halfSize && abs(gl_FragCoord.y - center.y) < halfSize) {
                            // Audio-reactive color control (Melody 1 - Piano+Bass)
                            float hue = u * 0.1 + sin(time * 1.3 + v * 20.0) * 0.05 + uMelody1 * 0.3;
                            float sat = 1.0;
                            float val = sin(time * 1.4 + v * u * 20.0) * 0.5 + 0.5;
                            
                            vec3 rgb = hsv2rgb(vec3(hue, sat, val));
                            gl_FragColor = vec4(rgb, 1.0);
                        }
                    }
                }
            }
        `;

        // Create shader material with audio-reactive uniforms
        const material = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                uTime: { value: 0.0 },
                uResolution: { value: new THREE.Vector2() },
                uMelody1: { value: 0.0 }, // Piano+Bass - color hue
                uMelody2: { value: 0.0 }, // Poly - scale
                uMelody3: { value: 0.0 }  // Drums - rotation speed
            }
        });

        // Create mesh
        this.audioReactiveSquare = new THREE.Mesh(geometry, material);
        this.audioReactiveSquare.position.set(0, 0, 0);
        this.scene.add(this.audioReactiveSquare);

        console.log('Audio-reactive shader plane created');
        console.log('Shader plane position:', this.audioReactiveSquare.position);
        console.log('Shader plane visible:', this.audioReactiveSquare.visible);
        console.log('Scene children count:', this.scene.children.length);
        console.log('Camera type:', this.camera.type);
        console.log('Camera position:', this.camera.position);

        // Test render
        this.renderer.render(this.scene, this.camera);
        console.log('Test render completed');
    }

    // Create audio analyzers connected to Tone.js gain nodes
    createAudioAnalyzers(pianoGain, bassGain, polyGain, drumGain) {
        console.log('Creating audio analyzers for visualization...');

        // Create Tone.js analyzers for each audio output
        // Melody1: Piano + Bass combined - create a mixer to combine both signals
        const melody1Analyzer = new Tone.Analyser('waveform', 256);
        const melody1Mixer = new Tone.Gain(0.5); // Reduce volume to prevent clipping
        pianoGain.connect(melody1Mixer);
        bassGain.connect(melody1Mixer);
        melody1Mixer.connect(melody1Analyzer);
        melody1Mixer.toDestination(); // Connect mixer to destination
        console.log('Connected pianoGain and bassGain to melody1 analyzer via mixer');

        // Melody2: Poly - connect to gain node
        const melody2Analyzer = new Tone.Analyser('waveform', 256);
        polyGain.connect(melody2Analyzer);
        polyGain.toDestination(); // Connect to destination
        console.log('Connected polyGain to melody2 analyzer');

        // Melody3: Drums - connect to gain node
        const melody3Analyzer = new Tone.Analyser('waveform', 256);
        drumGain.connect(melody3Analyzer);
        drumGain.toDestination(); // Connect to destination
        console.log('Connected drumGain to melody3 analyzer');

        // Store analyzers
        this.audioAnalyzers.melody1 = melody1Analyzer;
        this.audioAnalyzers.melody2 = melody2Analyzer;
        this.audioAnalyzers.melody3 = melody3Analyzer;

        console.log('✅ Audio analyzers created and connected');
        console.log('Audio routing for visualization:');
        console.log('  melody1: pianoGain + bassGain → Mixer → Analyzer + Destination');
        console.log('  melody2: polyGain → Analyzer + Destination');
        console.log('  melody3: drumGain → Analyzer + Destination');
    }

    // Handle window resize
    onWindowResize() {
        const container = document.getElementById('threejs-container');
        if (!container || !this.camera || !this.renderer) return;

        // For orthographic camera, we don't need to update aspect ratio
        // Just update renderer size
        this.renderer.setSize(container.clientWidth, container.clientHeight);

        // Update resolution uniform if shader is ready
        if (this.audioReactiveSquare && this.audioReactiveSquare.material.uniforms) {
            this.audioReactiveSquare.material.uniforms.uResolution.value.set(
                container.clientWidth,
                container.clientHeight
            );
        }
    }

    // Update audio data from analyzers
    updateAudioData() {
        if (!this.audioAnalyzers.melody1 || !this.audioAnalyzers.melody2 || !this.audioAnalyzers.melody3) return;

        // Get frequency data from analyzers (these return Float32Arrays)
        const melody1Data = this.audioAnalyzers.melody1.getValue();
        const melody2Data = this.audioAnalyzers.melody2.getValue();
        const melody3Data = this.audioAnalyzers.melody3.getValue();

        // Process Float32Arrays to get meaningful volume values
        // Calculate RMS (Root Mean Square) for volume
        const getRMS = (data) => {
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
                sum += data[i] * data[i];
            }
            return Math.sqrt(sum / data.length);
        };

        // Calculate average absolute value for simpler volume
        const getAverageVolume = (data) => {
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
                sum += Math.abs(data[i]);
            }
            return sum / data.length;
        };

        // Update audio data with processed values
        this.audioData.melody1.volume = getAverageVolume(melody1Data);
        this.audioData.melody2.volume = getAverageVolume(melody2Data);
        this.audioData.melody3.volume = getAverageVolume(melody3Data);

        // Store raw data for debugging
        this.audioData.melody1.rawData = melody1Data;
        this.audioData.melody2.rawData = melody2Data;
        this.audioData.melody3.rawData = melody3Data;

        // Console log the values for debugging (only occasionally to avoid spam)
        if (Math.random() < 0.01) { // 1% chance per frame
            console.log('Audio Data (processed):', {
                melody1: { volume: this.audioData.melody1.volume, hasData: melody1Data.some(v => v !== 0) },
                melody2: { volume: this.audioData.melody2.volume, hasData: melody2Data.some(v => v !== 0) },
                melody3: { volume: this.audioData.melody3.volume, hasData: melody3Data.some(v => v !== 0) }
            });
        }
    }

    // Start the animation loop
    startAnimation() {
        if (!this.visualizationInitialized || !this.audioReactiveSquare) {
            console.warn('Animation skipped - visualization not ready:', {
                visualizationInitialized: this.visualizationInitialized,
                audioReactiveSquare: !!this.audioReactiveSquare
            });
            return;
        }

        const animate = () => {
            this.animationId = requestAnimationFrame(animate);

            // Update audio data
            this.updateAudioData();

            // Update shader uniforms with audio data
            if (this.audioReactiveSquare && this.audioReactiveSquare.material.uniforms) {
                const uniforms = this.audioReactiveSquare.material.uniforms;

                // Update time uniform
                uniforms.uTime.value = Date.now() * 0.001;

                // Update resolution uniform
                uniforms.uResolution.value.set(this.renderer.domElement.width, this.renderer.domElement.height);

                // Map audio data to shader uniforms
                // Melody 1 (Piano+Bass) → Color hue
                uniforms.uMelody1.value = this.audioData.melody1.volume || 0;

                // Melody 2 (Poly) → Scale/size
                uniforms.uMelody2.value = this.audioData.melody2.volume || 0;

                // Melody 3 (Drums) → Rotation speed
                uniforms.uMelody3.value = this.audioData.melody3.volume || 0;
            }

            // Render the scene
            this.renderer.render(this.scene, this.camera);

            // Debug logging (only occasionally to avoid spam)
            if (Math.random() < 0.01) { // 1% chance per frame
                console.log('Rendering frame - shader plane visible:', this.audioReactiveSquare.visible);
                console.log('Audio data:', {
                    melody1: this.audioData.melody1.volume,
                    melody2: this.audioData.melody2.volume,
                    melody3: this.audioData.melody3.volume
                });
            }
        };

        animate();
    }

    // Stop the animation loop
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    // Clean up resources
    dispose() {
        this.stopAnimation();

        if (this.renderer) {
            this.renderer.dispose();
        }

        if (this.scene) {
            this.scene.clear();
        }

        window.removeEventListener('resize', this.onWindowResize);

        this.visualizationInitialized = false;
    }
}

// Export a singleton instance
export const audioVisualization = new AudioVisualization();
