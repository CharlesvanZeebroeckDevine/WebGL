import './style.css'
import { ElectricPiano, Smolken, DrumMachine, Mellotron, getMellotronNames } from 'smplr'
import * as Tone from "tone";
import { audioVisualization } from './visualization.js';

// Store the loaded JSON data
let basslineData, pianoData, polyData, drumData

// Create audio context - use Tone.js context
const context = Tone.getContext().rawContext

const mellotronInstruments = getMellotronNames();

// Initialize instruments WITHOUT destination - we'll set it after effects are created
// Temporarily they'll connect to nowhere
let leadSynth, bassSynth, drumMachine, mellotron

// Tone.js effects and gain nodes (will be initialized after user interaction)
let effects = null
let pianoGain = null
let bassGain = null
let polyGain = null
let drumGain = null
let effectsInitialized = false

// Function to initialize Tone.js effects after user interaction
async function initializeEffects() {
  if (effectsInitialized) return

  console.log('Initializing Tone.js effects...')

  // Create Tone.js gain nodes FIRST (without connecting to destination yet)
  pianoGain = new Tone.Gain(1)
  bassGain = new Tone.Gain(1)
  polyGain = new Tone.Gain(1)
  drumGain = new Tone.Gain(1)

  console.log('Tone.js gain nodes created')

  // NOW create smplr instruments WITH the Tone.js gain nodes as destinations
  // According to smplr docs: destination is an AudioNode in the constructor options
  leadSynth = new ElectricPiano(context, {
    instrument: "TX81Z",
    destination: pianoGain.input  // This is the native AudioNode inside Tone.Gain
  })

  bassSynth = new Smolken(context, {
    instrument: "Switched",
    destination: bassGain.input
  })

  drumMachine = new DrumMachine(context, {
    instrument: "TR-808",
    destination: drumGain.input
  })

  mellotron = new Mellotron(context, {
    instrument: mellotronInstruments[1],
    destination: polyGain.input
  })

  console.log('smplr instruments recreated with Tone.js destinations')

  // Wait for instruments to load
  try {
    await Promise.all([
      leadSynth.load,
      bassSynth.load,
      mellotron.load,
      drumMachine.load
    ])
    console.log('✓ All instruments loaded with Tone.js routing!')
  } catch (error) {
    console.error('Error loading instruments:', error)
  }

  // Initialize Tone.js effects for each instrument
  // According to Freeverb docs: https://tonejs.github.io/docs/14.7.77/Freeverb
  const createEffects = () => {
    // Create Freeverb with proper settings
    const reverb = new Tone.Freeverb()
    reverb.roomSize.value = 0.7  // Signal: 0-1, larger = longer decay
    reverb.dampening = 3000      // Direct property: Frequency for lowpass filter
    reverb.wet.value = 1         // Signal: 100% wet signal (fully effected)

    const bitcrusher = new Tone.BitCrusher(4)
    if (bitcrusher.wet) bitcrusher.wet.value = 1

    const distortion = new Tone.Distortion(0.4)
    if (distortion.wet) distortion.wet.value = 1

    const phaser = new Tone.Phaser({ frequency: 0.5, octaves: 3, baseFrequency: 350 })
    if (phaser.wet) phaser.wet.value = 1

    const vibrato = new Tone.Vibrato(5, 0.1)
    // Vibrato doesn't have a wet parameter (always 100%)

    return {
      bitcrusher,
      reverb,
      distortion,
      phaser,
      vibrato
    }
  }

  effects = {
    piano: createEffects(),
    bass: createEffects(),
    poly: createEffects(),
    drums: createEffects()
  }

  console.log('Effects created with WET=1 (100% effect signal)')
  console.log('Piano reverb settings:', {
    roomSize: effects.piano.reverb.roomSize.value,
    dampening: effects.piano.reverb.dampening,  // Direct property
    wet: effects.piano.reverb.wet.value
  })
  console.log('Piano bitcrusher settings:', {
    bits: effects.piano.bitcrusher.bits.value,
    wet: effects.piano.bitcrusher.wet ? effects.piano.bitcrusher.wet.value : 'N/A'
  })

  // Routing is now complete!
  // smplr instruments were created with destination: pianoGain.input
  // So the signal flow is: smplr instrument → Tone.Gain → (effects when enabled) → Destination

  // Apply any volume/mute states that were set before initialization
  if (trackVolumeState.piano !== 100 || trackMuteState.piano) {
    setTrackVolume('piano', trackVolumeState.piano)
  }
  if (trackVolumeState.bass !== 100 || trackMuteState.bass) {
    setTrackVolume('bass', trackVolumeState.bass)
  }
  if (trackVolumeState.poly !== 100 || trackMuteState.poly) {
    setTrackVolume('poly', trackVolumeState.poly)
  }
  if (trackVolumeState.drums !== 100 || trackMuteState.drums) {
    setTrackVolume('drums', trackVolumeState.drums)
  }

  effectsInitialized = true
  console.log('✅ Tone.js effects initialized successfully')
  console.log('✅ Audio routing: smplr → Tone.Gain → Effects → Destination')
  console.log('Effect nodes created:', Object.keys(effects.piano))

  // Initialize Three.js visualization and audio analyzers
  audioVisualization.initializeThreeJS()
  audioVisualization.createAudioAnalyzers(pianoGain, bassGain, polyGain, drumGain)
}

// State management
let isPlaying = false
let scheduledEvents = []
let trackMuteState = {
  piano: false,
  bass: false,
  poly: false,
  drums: false
}
let trackVolumeState = {
  piano: 100,
  bass: 100,
  poly: 100,
  drums: 100
}
let effectsState = {
  piano: { bitcrusher: false, reverb: false, distortion: false, phaser: false, vibrato: false },
  bass: { bitcrusher: false, reverb: false, distortion: false, phaser: false, vibrato: false },
  poly: { bitcrusher: false, reverb: false, distortion: false, phaser: false, vibrato: false },
  drums: { bitcrusher: false, reverb: false, distortion: false, phaser: false, vibrato: false }
}
let activeEffectChains = {
  piano: [],
  bass: [],
  poly: [],
  drums: []
}

// UI Elements
const startBtn = document.getElementById('start-btn')
const stopBtn = document.getElementById('stop-btn')
const statusText = document.getElementById('status-text')
const loadingText = document.getElementById('loading-text')

// Mute buttons
const mutePianoBtn = document.getElementById('mute-piano')
const muteBassBtn = document.getElementById('mute-bass')
const mutePolyBtn = document.getElementById('mute-poly')
const muteDrumsBtn = document.getElementById('mute-drums')

// Volume sliders
const volumePianoSlider = document.getElementById('volume-piano')
const volumeBassSlider = document.getElementById('volume-bass')
const volumePolySlider = document.getElementById('volume-poly')
const volumeDrumsSlider = document.getElementById('volume-drums')

// Volume value displays
const volumePianoValue = document.getElementById('volume-value-piano')
const volumeBassValue = document.getElementById('volume-value-bass')
const volumePolyValue = document.getElementById('volume-value-poly')
const volumeDrumsValue = document.getElementById('volume-value-drums')

// Function to load JSON tracks
async function loadJSONTracks() {
  try {
    // Fetch JSON files from the src directory
    const [basslineRes, pianoRes, polyRes, drumRes] = await Promise.all([
      fetch('./Bassline.JSON'),
      fetch('./Piano.JSON'),
      fetch('./Poly.JSON'),
      fetch('./DrumMachine.JSON')
    ])

    if (!basslineRes.ok || !pianoRes.ok || !polyRes.ok || !drumRes.ok) {
      throw new Error('Failed to fetch JSON files')
    }

    basslineData = await basslineRes.json()
    pianoData = await pianoRes.json()
    polyData = await polyRes.json()
    drumData = await drumRes.json()

    console.log('JSON data loaded:', {
      bassline: basslineData?.header?.name,
      piano: pianoData?.header?.name,
      poly: polyData?.header?.name,
      drums: drumData?.header?.name
    })

    // Set up Tone.js Transport with BPM from the JSON
    if (!basslineData?.header?.tempos?.[0]?.bpm) {
      console.warn('BPM not found in bassline data, using default 100')
    }
    const bpm = basslineData?.header?.tempos?.[0]?.bpm || 100
    Tone.Transport.bpm.value = bpm
    console.log(`Transport BPM set to: ${bpm}`)
    console.log('JSON tracks loaded successfully')

    return true
  } catch (error) {
    console.error('Error loading JSON tracks:', error)
    console.error('Error details:', error.message)
    return false
  }
}

// Function to schedule notes from JSON track to smplr instrument
function scheduleTrack(trackData, instrument, instrumentName) {
  if (!trackData.tracks || !trackData.tracks[0] || !trackData.tracks[0].notes) {
    console.warn(`No notes found in ${instrumentName} track`)
    return
  }

  const notes = trackData.tracks[0].notes
  console.log(`Scheduling ${notes.length} notes for ${instrumentName}`)

  notes.forEach(note => {
    // Schedule each note using Tone.js Transport
    const event = Tone.Transport.schedule((time) => {
      // Convert velocity (0-1 in JSON) to MIDI velocity (0-127)
      const velocity = Math.round(note.velocity * 127)

      // Start the note with smplr
      instrument.start({
        note: note.midi,
        velocity: velocity,
        duration: note.duration
      })
    }, note.time)

    scheduledEvents.push(event)
  })
}

// Function to schedule drum notes from JSON track to drum machine
function scheduleDrumTrack(trackData, drumMachine, instrumentName, loopDuration = null) {
  if (!trackData.tracks || !trackData.tracks[0] || !trackData.tracks[0].notes) {
    console.warn(`No notes found in ${instrumentName} track`)
    return
  }

  const notes = trackData.tracks[0].notes
  const drumTrackDuration = notes[notes.length - 1].time

  console.log(`Scheduling ${notes.length} drum notes for ${instrumentName}`)
  console.log(`Drum track duration: ${drumTrackDuration}s`)

  // If loopDuration is provided, repeat the drum pattern to fill the entire sequence
  if (loopDuration && loopDuration > drumTrackDuration) {
    const repetitions = Math.ceil(loopDuration / drumTrackDuration)
    console.log(`Repeating drum pattern ${repetitions} times to fill ${loopDuration}s sequence`)

    for (let repetition = 0; repetition < repetitions; repetition++) {
      const offset = repetition * drumTrackDuration

      notes.forEach(note => {
        const scheduledTime = note.time + offset

        // Only schedule if within the loop duration
        if (scheduledTime < loopDuration) {
          const event = Tone.Transport.schedule((time) => {
            const velocity = Math.round(note.velocity * 127)

            drumMachine.start({
              note: note.name,
              velocity: velocity,
              duration: note.duration
            })
          }, scheduledTime)

          scheduledEvents.push(event)
        }
      })
    }
  } else {
    // Original scheduling for single playthrough
    notes.forEach(note => {
      const event = Tone.Transport.schedule((time) => {
        const velocity = Math.round(note.velocity * 127)

        drumMachine.start({
          note: note.name,
          velocity: velocity,
          duration: note.duration
        })
      }, note.time)

      scheduledEvents.push(event)
    })
  }
}

// Function to load JSON tracks at page load
async function loadTracks() {
  loadingText.textContent = 'Loading JSON tracks...'

  try {
    // Load the JSON data (instruments will be created later on first playback)
    const jsonLoaded = await loadJSONTracks()
    if (!jsonLoaded) {
      throw new Error('Failed to load JSON tracks')
    }

    console.log('JSON tracks loaded successfully')
    loadingText.textContent = ''
    statusText.textContent = 'Ready to play'

    return true
  } catch (error) {
    console.error('Error loading:', error)
    loadingText.textContent = 'Error loading'
    return false
  }
}

// Start playback
async function startPlayback() {
  if (isPlaying) return

  // Check if JSON data is loaded
  if (!basslineData || !pianoData || !polyData || !drumData) {
    console.error('JSON tracks not loaded yet')
    statusText.textContent = 'Error: Tracks not loaded'
    return
  }

  try {
    statusText.textContent = 'Starting audio...'

    // Ensure audio context is resumed and initialize effects
    await Tone.start()
    await context.resume()

    // Initialize Tone.js effects on first playback
    if (!effectsInitialized) {
      statusText.textContent = 'Initializing effects...'
      await initializeEffects()
    }
  } catch (error) {
    console.error('Error starting playback:', error)
    statusText.textContent = 'Error starting playback'
    return
  }

  // Clear any previously scheduled events
  Tone.Transport.cancel()
  scheduledEvents = []

  // Calculate the maximum duration first
  const maxDuration = Math.max(
    pianoData.tracks[0].notes[pianoData.tracks[0].notes.length - 1].time,
    basslineData.tracks[0].notes[basslineData.tracks[0].notes.length - 1].time,
    polyData.tracks[0].notes[polyData.tracks[0].notes.length - 1].time
  ) + 2 // Add 2 seconds buffer

  // Get drum track duration for reference
  const drumDuration = drumData.tracks[0].notes[drumData.tracks[0].notes.length - 1].time
  console.log(`Drum track duration: ${drumDuration}s, Full sequence duration: ${maxDuration}s`)

  // Schedule all tracks
  statusText.textContent = 'Scheduling tracks...'
  scheduleTrack(pianoData, leadSynth, 'Piano (Lead)')
  scheduleTrack(basslineData, bassSynth, 'Bassline')
  scheduleTrack(polyData, mellotron, 'Poly (Mellotron)')

  // Schedule drum track with loop duration to repeat pattern throughout the sequence
  scheduleDrumTrack(drumData, drumMachine, 'Drums', maxDuration)

  Tone.Transport.loop = true
  Tone.Transport.loopStart = 0
  Tone.Transport.loopEnd = maxDuration

  // Start the transport
  Tone.getTransport().start()

  // Start visualization animation
  audioVisualization.startAnimation()

  isPlaying = true
  startBtn.disabled = true
  stopBtn.disabled = false
  const currentBpm = Tone.Transport.bpm.value
  statusText.textContent = `Playing (${currentBpm} BPM)`

  console.log(`Playback started - Loop duration: ${maxDuration}s`)
}

// Stop playback
function stopPlayback() {
  if (!isPlaying) return

  Tone.Transport.stop()
  Tone.Transport.cancel()
  scheduledEvents = []

  // Stop all instruments
  leadSynth.stop()
  bassSynth.stop()
  mellotron.stop()
  drumMachine.stop()

  // Stop visualization animation
  audioVisualization.stopAnimation()

  isPlaying = false
  startBtn.disabled = false
  stopBtn.disabled = true
  statusText.textContent = 'Stopped'

  console.log('Playback stopped')
}

// Helper function to get instrument by track name
function getInstrument(track) {
  switch (track) {
    case 'piano':
      return leadSynth
    case 'bass':
      return bassSynth
    case 'poly':
      return mellotron
    case 'drums':
      return drumMachine
    default:
      return null
  }
}

// Function to set volume for a track
function setTrackVolume(track, volume) {
  const instrument = getInstrument(track)

  if (instrument && instrument.output) {
    // Only set volume if not muted
    const actualVolume = trackMuteState[track] ? 0 : volume
    instrument.output.setVolume(actualVolume)
  } else if (!effectsInitialized) {
    console.log('Instruments not initialized yet, volume will be applied after start')
  }

  trackVolumeState[track] = volume
}

// Function to handle volume slider changes
function handleVolumeChange(track, slider, valueDisplay) {
  const volume = parseInt(slider.value)
  valueDisplay.textContent = volume
  setTrackVolume(track, volume)
  console.log(`${track} volume: ${volume}`)
}

// Function to toggle mute state
function toggleMute(track, button) {
  trackMuteState[track] = !trackMuteState[track]
  const isMuted = trackMuteState[track]

  // Get the corresponding instrument
  const instrument = getInstrument(track)

  // Set instrument volume (0 = muted, current volume = unmuted)
  if (instrument && instrument.output) {
    instrument.output.setVolume(isMuted ? 0 : trackVolumeState[track])
  } else if (!effectsInitialized) {
    console.log('Instruments not initialized yet, mute state saved')
  }

  // Update button appearance
  const muteIcon = button.querySelector('.mute-icon')
  const muteText = button.querySelector('.mute-text')

  if (isMuted) {
    button.classList.add('muted')
    muteIcon.textContent = '🔇'
    muteText.textContent = 'Unmute'
  } else {
    button.classList.remove('muted')
    muteIcon.textContent = '🔊'
    muteText.textContent = 'Mute'
  }

  console.log(`${track} ${isMuted ? 'muted' : 'unmuted'}`)
}

// Function to get gain node by track
function getGainNode(track) {
  switch (track) {
    case 'piano':
      return pianoGain
    case 'bass':
      return bassGain
    case 'poly':
      return polyGain
    case 'drums':
      return drumGain
    default:
      return null
  }
}

// Function to rebuild effect chain for a track
function rebuildEffectChain(track) {
  if (!effectsInitialized || !effects) {
    console.warn('Effects not initialized yet')
    return
  }

  const gainNode = getGainNode(track)
  if (!gainNode) return

  // Disconnect all effects but preserve analyzer connections
  gainNode.disconnect()
  Object.values(effects[track]).forEach(effect => {
    effect.disconnect()
  })

  // Get active effects in order
  const activeEffects = []
  const activeEffectNames = []
  Object.entries(effectsState[track]).forEach(([effectName, isActive]) => {
    if (isActive) {
      activeEffects.push(effects[track][effectName])
      activeEffectNames.push(effectName)
    }
  })

  // Reconnect chain: gainNode -> effects -> destination
  if (activeEffects.length > 0) {
    console.log(`${track} building chain with effects:`, activeEffectNames)

    // Connect gain node to first effect
    gainNode.connect(activeEffects[0])
    console.log(`  ✓ Connected gain → ${activeEffectNames[0]}`)

    // Connect effects in series
    for (let i = 0; i < activeEffects.length - 1; i++) {
      activeEffects[i].connect(activeEffects[i + 1])
      console.log(`  ✓ Connected ${activeEffectNames[i]} → ${activeEffectNames[i + 1]}`)
    }

    // Connect last effect to destination
    activeEffects[activeEffects.length - 1].toDestination()
    console.log(`  ✓ Connected ${activeEffectNames[activeEffects.length - 1]} → Destination`)

    // Log effect settings
    activeEffects.forEach((effect, i) => {
      if (effect.wet) {
        console.log(`  ${activeEffectNames[i]} wet:`, effect.wet.value)
      }
    })

    console.log(`${track} effect chain complete!`)
  } else {
    // No effects active, connect gain directly to destination
    gainNode.toDestination()
    console.log(`${track} effect chain rebuilt: [no effects - direct connection]`)
  }

  // IMPORTANT: Reconnect analyzers after rebuilding the effect chain
  // This ensures visualization continues to work even with effects enabled
  if (audioVisualization && audioVisualization.audioAnalyzers) {
    reconnectAnalyzers(track, gainNode)
  }

  activeEffectChains[track] = activeEffects
}

// Function to reconnect analyzers after effect chain changes
function reconnectAnalyzers(track, gainNode) {
  if (!audioVisualization.audioAnalyzers) return

  switch (track) {
    case 'piano':
      if (audioVisualization.audioAnalyzers.melody1) {
        gainNode.connect(audioVisualization.audioAnalyzers.melody1)
        console.log(`  ✓ Reconnected ${track} to melody1 analyzer`)
      }
      break
    case 'bass':
      if (audioVisualization.audioAnalyzers.melody1) {
        gainNode.connect(audioVisualization.audioAnalyzers.melody1)
        console.log(`  ✓ Reconnected ${track} to melody1 analyzer`)
      }
      break
    case 'poly':
      if (audioVisualization.audioAnalyzers.melody2) {
        gainNode.connect(audioVisualization.audioAnalyzers.melody2)
        console.log(`  ✓ Reconnected ${track} to melody2 analyzer`)
      }
      break
    case 'drums':
      if (audioVisualization.audioAnalyzers.melody3) {
        gainNode.connect(audioVisualization.audioAnalyzers.melody3)
        console.log(`  ✓ Reconnected ${track} to melody3 analyzer`)
      }
      break
  }
}

// Function to toggle effect
function toggleEffect(track, effectName, checkbox) {
  effectsState[track][effectName] = checkbox.checked
  console.log(`${track} ${effectName}: ${checkbox.checked ? 'ON' : 'OFF'}`)
  console.log('Current effect state for', track, ':', effectsState[track])
  rebuildEffectChain(track)
}

// Function to update effect parameter
function updateEffectParam(track, effectName, value, displayElement) {
  if (!effectsInitialized || !effects) {
    console.warn('Effects not initialized yet')
    return
  }

  const effect = effects[track][effectName]
  const numValue = parseFloat(value)

  switch (effectName) {
    case 'bitcrusher':
      effect.bits.value = parseInt(value)
      displayElement.textContent = `${value} bits`
      console.log(`${track} bitcrusher bits:`, effect.bits.value)
      break
    case 'reverb':
      // Freeverb: roomSize is a Signal, controls decay time (0-1)
      effect.roomSize.value = numValue
      displayElement.textContent = numValue.toFixed(2)
      console.log(`${track} reverb roomSize:`, effect.roomSize.value)
      break
    case 'distortion':
      effect.distortion = numValue
      displayElement.textContent = numValue.toFixed(2)
      console.log(`${track} distortion:`, effect.distortion)
      break
    case 'phaser':
      effect.frequency.value = numValue
      displayElement.textContent = `${numValue.toFixed(1)} Hz`
      console.log(`${track} phaser frequency:`, effect.frequency.value)
      break
    case 'vibrato':
      effect.frequency.value = numValue
      displayElement.textContent = `${numValue.toFixed(1)} Hz`
      console.log(`${track} vibrato frequency:`, effect.frequency.value)
      break
  }
}

// Function to toggle effects panel visibility
function toggleEffectsPanel(track) {
  if (!effectsInitialized) {
    alert('Effects will be available after you start playback for the first time!')
    return
  }

  const panel = document.getElementById(`effects-${track}`)
  if (panel.style.display === 'none' || panel.style.display === '') {
    panel.style.display = 'block'
  } else {
    panel.style.display = 'none'
  }
}

// Test function to verify effects work with pure Tone.js
async function testEffect() {
  await Tone.start()

  if (!effectsInitialized) {
    await initializeEffects()
  }

  console.log('🔊 Testing effect chain with Tone.js synth...')
  console.log('Piano reverb active:', effectsState.piano.reverb)

  // Create a simple Tone.js synth
  const testSynth = new Tone.Synth().connect(pianoGain)

  // Play a note
  testSynth.triggerAttackRelease("C4", "4n")

  console.log('Test synth → piano gain → ' + (effectsState.piano.reverb ? 'reverb → ' : '') + 'destination')
  console.log('If you hear reverb on this test note, effects work but smplr routing is the issue')
  console.log('If you DON\'T hear reverb, the effect chain itself has an issue')

  // Clean up
  setTimeout(() => {
    testSynth.dispose()
  }, 2000)
}

// Event listeners for playback
startBtn.onclick = startPlayback
stopBtn.onclick = stopPlayback
document.getElementById('test-effect-btn').onclick = testEffect

// Event listeners for mute buttons
mutePianoBtn.onclick = () => toggleMute('piano', mutePianoBtn)
muteBassBtn.onclick = () => toggleMute('bass', muteBassBtn)
mutePolyBtn.onclick = () => toggleMute('poly', mutePolyBtn)
muteDrumsBtn.onclick = () => toggleMute('drums', muteDrumsBtn)

// Event listeners for volume sliders
volumePianoSlider.oninput = () => handleVolumeChange('piano', volumePianoSlider, volumePianoValue)
volumeBassSlider.oninput = () => handleVolumeChange('bass', volumeBassSlider, volumeBassValue)
volumePolySlider.oninput = () => handleVolumeChange('poly', volumePolySlider, volumePolyValue)
volumeDrumsSlider.oninput = () => handleVolumeChange('drums', volumeDrumsSlider, volumeDrumsValue)

// Event listeners for effects toggle buttons
document.querySelectorAll('.effects-toggle-btn').forEach(btn => {
  btn.onclick = () => toggleEffectsPanel(btn.dataset.track)
})

// Event listeners for effect toggles
document.querySelectorAll('.effect-toggle').forEach(checkbox => {
  checkbox.onchange = () => {
    toggleEffect(checkbox.dataset.track, checkbox.dataset.effect, checkbox)
  }
})

// Event listeners for effect parameters
document.querySelectorAll('.effect-param').forEach(slider => {
  const track = slider.dataset.track
  const effectName = slider.dataset.effect
  const displayElement = document.querySelector(`.effect-value[data-track="${track}"][data-effect="${effectName}"]`)

  slider.oninput = () => {
    updateEffectParam(track, effectName, slider.value, displayElement)
  }
})

// Load instruments on page load
loadTracks().then(success => {
  if (success) {
    console.log('Ready to play')
  }
})
