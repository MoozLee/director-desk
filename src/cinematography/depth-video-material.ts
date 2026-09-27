import { DoubleSide, MeshDepthMaterial } from 'three';
import type { DepthRange } from './depth-video.ts';

/** Write display depth before MSAA resolves coverage, preserving the raw depth buffer. */
export class DepthVideoMaterial extends MeshDepthMaterial {
    private readonly rangeUniforms = {
        displayNear: { value: .1 }, displayFar: { value: 30 },
        displayInvert: { value: false },
    };

    constructor() {
        super({ side: DoubleSide });
        this.toneMapped = false;
        this.onBeforeCompile = shader => {
            Object.assign(shader.uniforms, this.rangeUniforms);
            // Keep Three's skinning, morphing, instancing and displacement vertex path.
            shader.vertexShader = 'varying float displayDistance;\n' + shader.vertexShader.replace(
                '#include <project_vertex>', '#include <project_vertex>\n displayDistance = -mvPosition.z;',
            );
            shader.fragmentShader = `uniform float displayNear, displayFar;
uniform bool displayInvert;
varying float displayDistance;
` + shader.fragmentShader.replace(
                'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
                `float gray = 1.0 - clamp((displayDistance - displayNear) / (displayFar - displayNear), 0.0, 1.0);
                if (displayInvert) gray = 1.0 - gray;
                gl_FragColor = vec4(vec3(gray), 1.0);`,
            );
        };
    }

    override customProgramCacheKey() { return 'director-linear-display-depth-v1'; }

    setRange(range: DepthRange) {
        this.rangeUniforms.displayNear.value = range.near;
        this.rangeUniforms.displayFar.value = range.far;
        this.rangeUniforms.displayInvert.value = range.invert;
    }
}
