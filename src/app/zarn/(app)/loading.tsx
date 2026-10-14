// Shown instantly while a ZARN screen loads (the rail, sidebar and tab bar stay in place).
export default function Loading(){
 return <div className="zn-skel" aria-busy="true" aria-label="Loading">
  <div className="zn-skel-head"><i/></div>
  {Array.from({length:8},(_,k)=><div key={k} className="zn-skel-row"><b/><span><i/><i/></span></div>)}
 </div>;
}
