'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="not-found-page"><span className="eyebrow">A brief interruption</span><h1>Something didn’t load.</h1><p>Please try again. You can also reach us at hello@zaane.co.</p><button className="studio-button black-button" onClick={reset}>Try again →</button></main>;}
