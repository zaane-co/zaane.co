// Shown instantly while an admin page loads, so clicks always respond (the sidebar stays in place).
export default function Loading(){
 return <div className="za-page za-skel" aria-busy="true" aria-label="Loading">
  <div className="za-skel-head"><i/><i/></div>
  <div className="za-skel-row"><i/><i/><i/><i/></div>
  <div className="za-skel-card">{Array.from({length:7},(_,k)=><i key={k}/>)}</div>
 </div>;
}
