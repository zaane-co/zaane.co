'use client';
import {Bookmark,Star} from 'lucide-react';
import {ChannelRow,useNav} from './nav';
import SavedMessages from './SavedMessages';
// One place for everything you kept: chats you starred and messages you saved for later.
export default function SavedPage(){
 const {starred}=useNav();
 return <div className="zn-page">
  <header className="zn-page-head"><div><h1><Bookmark size={20}/>Saved</h1><p>Chats you starred and messages you saved for later.</p></div></header>
  <div className="zn-saved-page" data-lenis-prevent>
   {starred.length>0&&<section>
    <h2 className="zn-section-label"><Star size={12}/>Starred chats · {starred.length}</h2>
    <div className="zn-starred-list">{starred.map(c=><ChannelRow key={c.id} c={c} big/>)}</div>
   </section>}
   <section>
    {starred.length>0&&<h2 className="zn-section-label"><Bookmark size={12}/>Saved messages</h2>}
    <SavedMessages/>
   </section>
  </div>
 </div>;
}
