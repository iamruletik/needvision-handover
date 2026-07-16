import { Fn, float, select, vec2 } from 'three/tsl';
import type { Node } from 'three/webgpu';

const selectVec2 = select as unknown as (cond: unknown, ifTrue: unknown, ifFalse: unknown) => Node<'vec2'>;

const newUvSelect = (rs: Node<'float'>, ri: Node<'float'>, i: Node<'vec2'>, s: Node<'vec2'>) =>
    selectVec2(rs.lessThan(ri), vec2(i.x.mul(s.y).div(i.y), s.y), vec2(s.x, i.y.mul(s.x).div(i.x)));

const offsetSelect = (rs: Node<'float'>, ri: Node<'float'>, newUv: Node<'vec2'>, s: Node<'vec2'>) =>
    selectVec2(rs.lessThan(ri), vec2(newUv.x.sub(s.x).div(2.0), 0.0), vec2(0.0, newUv.y.sub(s.y).div(2.0))).div(newUv);

export const coverTextureUv = /*#__PURE__*/ Fn(
    (
        [imgSize_immutable, planeSize_immutable, ouv_immutable]: [Node<'vec2'>, Node<'vec2'>, Node<'vec2'>],
    ) => {
        const ouv = vec2(ouv_immutable).toVar();
        const planeSize = vec2(planeSize_immutable).toVar();
        const imgSize = vec2(imgSize_immutable).toVar();
        const s = vec2(planeSize).toVar();
        const i = vec2(imgSize).toVar();
        const rs = float(s.x.div(s.y)).toVar();
        const ri = float(i.x.div(i.y)).toVar();
        const newUv = vec2(newUvSelect(rs, ri, i, s)).toVar();
        const offset = vec2(offsetSelect(rs, ri, newUv, s)).toVar();

        return vec2(ouv.mul(s).div(newUv).add(offset)).toVar();
    },
).setLayout({
    name: 'coverTextureUv',
    type: 'vec2',
    inputs: [
        { name: 'imgSize', type: 'vec2' },
        { name: 'planeSize', type: 'vec2' },
        { name: 'ouv', type: 'vec2' },
    ],
});
