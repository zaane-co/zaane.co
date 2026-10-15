// The company's official bank accounts, kept in Settings (bank_1_*, bank_2_*) and printed on every invoice.
export type BankAccount={currency:string;bank:string;name:string;number:string;extra:string};
export function bankAccounts(s:Record<string,string>):BankAccount[]{
 return [1,2].map(n=>({currency:s[`bank_${n}_currency`]??'',bank:s[`bank_${n}_bank`]??'',name:s[`bank_${n}_name`]??'',number:s[`bank_${n}_number`]??'',extra:s[`bank_${n}_extra`]??''})).filter(a=>a.bank||a.number||a.name);
}
// Accounts for an invoice's currency; falls back to accounts open to any currency, then to all of them.
export function accountsFor(s:Record<string,string>,currency:string){
 const all=bankAccounts(s),exact=all.filter(a=>a.currency===currency),open=all.filter(a=>!a.currency);
 return exact.length?exact:open.length?open:all;
}
