import type {Map as LeafletMap} from "leaflet";
/** Screen-space event density, not territory ownership or an absolute rate. */
export function addCombatHeat(map:LeafletMap,points:[number,number][],radius=36){
  const canvas=document.createElement("canvas");canvas.className="combat-heat-canvas";
  Object.assign(canvas.style,{position:"absolute",inset:"0",pointerEvents:"none",zIndex:"350"});
  canvas.setAttribute("aria-hidden","true");map.getPanes().overlayPane.appendChild(canvas);
  const mask=document.createElement("canvas");let pending=0,disposed=false;
  const draw=()=>{
    pending=0;if(disposed)return;
    const origin=map.containerPointToLayerPoint([0,0]);canvas.style.transform=`translate(${origin.x}px,${origin.y}px)`;
    const size=map.getSize();canvas.width=mask.width=size.x;canvas.height=mask.height=size.y;
    const ctx=mask.getContext("2d",{willReadFrequently:true}),out=canvas.getContext("2d");if(!ctx||!out||!size.x||!size.y)return;
    for(const point of points){const p=map.latLngToContainerPoint(point);if(p.x < -radius||p.y < -radius||p.x>size.x+radius||p.y>size.y+radius)continue;
      const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);g.addColorStop(0,"rgba(0,0,0,.28)");g.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=g;ctx.fillRect(p.x-radius,p.y-radius,radius*2,radius*2);
    }
    const data=ctx.getImageData(0,0,size.x,size.y);
    for(let i=0;i<data.data.length;i+=4){const a=data.data[i+3],v=a/255;
      data.data[i]=Math.round(255*Math.min(1,Math.max(0,(v-.25)*4)));
      data.data[i+1]=Math.round(255*Math.min(1,v*4,Math.max(0,(1-v)*4)));
      data.data[i+2]=Math.round(255*Math.max(0,1-v*2));data.data[i+3]=Math.min(210,a*2);
    }
    out.putImageData(data,0,0);
  };
  const schedule=()=>{if(!pending&&!disposed)pending=requestAnimationFrame(draw);};
  map.on("move zoom resize",schedule);schedule();
  return ()=>{disposed=true;cancelAnimationFrame(pending);map.off("move zoom resize",schedule);canvas.remove();};
}
