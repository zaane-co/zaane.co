// The company's bank accounts, printed on invoices. Each invoice can point at one; otherwise a sensible default is used.
export type BankAccount={id:string;currency:string;bank:string;account_name:string;account_number:string;extra:string;is_default:boolean};
export const bankColumns='id,currency,bank,account_name,account_number,extra,is_default';
export const bankLabel=(a:BankAccount)=>`${a.bank} · ${a.account_number}`;
// The account for an invoice: the one chosen, else the default for its currency, else any account for that currency, else the default.
export function pickAccount(accounts:BankAccount[],currency:string,chosen?:string|null){
 return accounts.find(a=>a.id===chosen)
  ??accounts.find(a=>a.currency===currency&&a.is_default)??accounts.find(a=>a.currency===currency)
  ??accounts.find(a=>!a.currency&&a.is_default)??accounts.find(a=>!a.currency)??accounts.find(a=>a.is_default)??accounts[0]??null;
}
