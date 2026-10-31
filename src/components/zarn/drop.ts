// Files dropped anywhere in ZARN go to the newest message box that is open (a thread's box sits on top of its channel's).
// Without this, a drop outside the box makes the browser open the file and leave ZARN.
type Handler=(files:FileList)=>void;
const stack:Handler[]=[];
export function registerDrop(fn:Handler){stack.push(fn);return()=>{const i=stack.indexOf(fn);if(i>=0)stack.splice(i,1);};}
export const hasDropTarget=()=>stack.length>0;
export function deliverDrop(files:FileList){stack[stack.length-1]?.(files);}
export const isFileDrag=(e:DragEvent|React.DragEvent)=>!!e.dataTransfer&&Array.from(e.dataTransfer.types).includes('Files');
