import test from 'node:test';
import assert from 'node:assert/strict';
import {RendererResources} from '../../pilot-3d/sample/renderer-resources.mjs';

function fixture(){
 const properties=new WeakMap(),calls=[];
 const renderer={properties:{get(material){calls.push(material);return properties.get(material)??{};}}};
 const root=materials=>({traverse(fn){fn({name:'root'});for(const material of materials)fn({material});}});
 const texture=(name='DFG_LUT',isTexture=true)=>({name,isTexture,disposed:0,dispose(){this.disposed++;}});
 return{properties,calls,renderer,root,texture};
}

test('renderer resources captures the rendered uniform, not a material-side lookalike',()=>{
 const f=fixture(),material={},actual=f.texture(),decoy=f.texture();material.dfgLUT=decoy;
 f.properties.set(material,{uniforms:{dfgLUT:{value:actual}}});
 const owner=new RendererResources(f.renderer);owner.capture(f.root([material]));owner.dispose();
 assert.equal(actual.disposed,1);assert.equal(decoy.disposed,0);assert(f.calls.includes(material));
});

test('renderer resources can capture after first compilation and disposes repeated shared materials once',()=>{
 const f=fixture(),a={},b={},shared=f.texture(),owner=new RendererResources(f.renderer);
 owner.capture(f.root([a]));assert.equal(shared.disposed,0);
 f.properties.set(a,{uniforms:{dfgLUT:{value:shared}}});f.properties.set(b,{uniforms:{dfgLUT:{value:shared}}});
 owner.capture(f.root([[a,b],a,b]));owner.capture(f.root([b]));owner.dispose();owner.dispose();
 assert.equal(shared.disposed,1,'one owner must release its actual shared LUT exactly once');
});

test('renderer resources ignores absent, non-texture and differently named uniforms',()=>{
 const f=fixture(),wrongName=f.texture('ordinary diffuse map'),notTexture=f.texture('DFG_LUT',false),fakeMaterial={};
 const a={},b={},c={};f.properties.set(a,{uniforms:{dfgLUT:{value:wrongName}}});f.properties.set(b,{uniforms:{dfgLUT:{value:notTexture}}});f.properties.set(c,{uniforms:{other:{value:f.texture()}}});
 fakeMaterial.dfgLUT=f.texture();const owner=new RendererResources(f.renderer);owner.capture(f.root([a,b,c,fakeMaterial,null]));owner.dispose();
 assert.equal(wrongName.disposed,0);assert.equal(notTexture.disposed,0);assert.equal(fakeMaterial.dfgLUT.disposed,0);
});

test('renderer resources keeps the first actual LUT and never reacquires after disposal',()=>{
 const f=fixture(),first=f.texture(),later=f.texture(),a={},b={},owner=new RendererResources(f.renderer);
 f.properties.set(a,{uniforms:{dfgLUT:{value:first}}});f.properties.set(b,{uniforms:{dfgLUT:{value:later}}});
 owner.capture(f.root([a,b]));owner.dispose();owner.capture(f.root([b]));owner.dispose();
 assert.equal(first.disposed,1);assert.equal(later.disposed,0);
});

test('renderer resources permits empty scene disposal before any material compiles',()=>{
 const f=fixture(),owner=new RendererResources(f.renderer);owner.capture(f.root([]));assert.doesNotThrow(()=>owner.dispose());assert.doesNotThrow(()=>owner.dispose());
});

test('renderer resources releases a context epoch, recaptures restored uniforms and finally disposes once',()=>{
 const f=fixture(),a={},before=f.texture(),after=f.texture(),owner=new RendererResources(f.renderer);
 f.properties.set(a,{uniforms:{dfgLUT:{value:before}}});owner.capture(f.root([a]));owner.release();owner.release();
 assert.equal(before.disposed,1,'repeated context loss must not repeat a release');
 f.properties.set(a,{uniforms:{dfgLUT:{value:after}}});owner.capture(f.root([a]));owner.dispose();owner.release();owner.dispose();
 assert.equal(before.disposed,1);assert.equal(after.disposed,1,'the restored epoch must release its actual current LUT');
});
