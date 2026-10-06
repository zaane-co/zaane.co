const tone:Record<string,string>={new:'red',review:'amber',contacted:'amber',in_progress:'amber',qualified:'blue',published:'green',won:'green',resolved:'green',draft:'grey',lost:'grey'};
export function Status({value}:{value?:string|null}){if(!value)return null;return <span className={`za-status za-status-${tone[value]||'grey'}`}>{value.replace('_',' ')}</span>;}
export function when(v?:string|null){if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}
