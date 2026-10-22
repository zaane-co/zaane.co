// Painted the moment the page shell arrives, while the signed-in layout is still fetching members and channels.
export default function Loading(){
 return <div className="zn-boot" aria-busy="true" aria-label="Loading"><img src="/zarnlogo.png" alt="ZARN"/></div>;
}
