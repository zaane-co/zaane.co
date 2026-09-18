'use client';
import {useState} from 'react';
export default function Logout(){const [error,setError]=useState(false);return <><button onClick={async()=>{try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});if(!r.ok)throw new Error();window.location.assign('/admin/login');}catch{setError(true);}}}>Sign out ↗</button>{error&&<span role="alert">Could not sign out. Try again.</span>}</>;}
