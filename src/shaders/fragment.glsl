// Converted Shadertoy shader with audio-reactive uniforms
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
