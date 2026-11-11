import {useEffect,useRef,useState} from 'react';
import {getDocument,GlobalWorkerOptions,type PDFDocumentProxy} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {errorMessage} from './errors';
GlobalWorkerOptions.workerSrc=workerUrl;

/** Render authenticated bytes locally; no browser PDF plugin or external document service. */
export function PdfCanvas({blob}:{blob:Blob}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const [document,setDocument]=useState<PDFDocumentProxy|null>(null);
  const [page,setPage]=useState(1),[zoom,setZoom]=useState(1);
  const [error,setError]=useState(''),[rendering,setRendering]=useState(true);
  useEffect(()=>{
    let active=true;let task:ReturnType<typeof getDocument>|undefined;
    setDocument(null);setPage(1);setZoom(1);setError('');setRendering(true);
    void blob.arrayBuffer().then(data=>{
      if(!active)return;
      task=getDocument({data:new Uint8Array(data),isEvalSupported:false});
      return task.promise.then(doc=>{if(active)setDocument(doc);});
    }).catch(e=>{if(active){setError(errorMessage(e));setRendering(false);}});
    return()=>{active=false;void task?.destroy().catch(()=>{});};
  },[blob]);
  useEffect(()=>{
    if(!document)return;
    let active=true;let render:ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']>|undefined;
    setRendering(true);setError('');
    // Each render owns a new canvas, so cancelled work cannot race a new page/zoom.
    const output=window.document.createElement('canvas');
    void document.getPage(page).then(pdfPage=>{
      if(!active)return;
      const ratio=Math.min(window.devicePixelRatio||1,2);
      const viewport=pdfPage.getViewport({scale:zoom});
      if(viewport.width*viewport.height*ratio*ratio>32_000_000||Math.max(viewport.width,viewport.height)*ratio>16384)throw Error('PDF page exceeds the safe canvas size; reduce zoom or download the file');
      output.width=Math.ceil(viewport.width*ratio);output.height=Math.ceil(viewport.height*ratio);
      render=pdfPage.render({canvas:output,viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]});
      return render.promise.then(()=>{
        if(!active||!canvas.current)return;
        const target=canvas.current;target.width=output.width;target.height=output.height;
        target.style.width=`${viewport.width}px`;target.style.height=`${viewport.height}px`;
        target.getContext('2d')!.drawImage(output,0,0);setRendering(false);
      });
    }).catch(e=>{if(active){setError(errorMessage(e));setRendering(false);}});
    return()=>{active=false;render?.cancel();};
  },[document,page,zoom]);
  return <div>
    <div className="preview-toolbar">
      <button disabled={!document||page<=1} onClick={()=>setPage(p=>p-1)}>Previous page</button>
      <span>Page {page} of {document?.numPages||'…'}</span>
      <button disabled={!document||page>=document.numPages} onClick={()=>setPage(p=>p+1)}>Next page</button>
      <button disabled={zoom<=0.5} onClick={()=>setZoom(z=>Math.max(0.5,z-0.25))}>Zoom out</button>
      <span>{Math.round(zoom*100)}%</span>
      <button disabled={zoom>=3} onClick={()=>setZoom(z=>Math.min(3,z+0.25))}>Zoom in</button>
    </div>
    {rendering&&!error&&<p role="status">Rendering PDF…</p>}
    {error&&<p role="alert" className="error">PDF preview failed: {error}. Download this version to inspect it.</p>}
    <div className="pdf-canvas-scroll"><canvas ref={canvas} aria-label={`PDF page ${page}`} style={{visibility:rendering||error?'hidden':'visible'}}/></div>
  </div>;
}
