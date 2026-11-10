export const customerLoginPurposes=['CUSTOMER','CUSTOMER_REGISTER','CUSTOMER_PASSWORD_RESET'];

export function customerLoginDestination(purpose:string,customer:{portalRegistrationPending:boolean;portalProfileIncomplete:boolean}|null){
 if(purpose==='CUSTOMER_REGISTER'&&!customer)return '/customer?register=1';
 if(purpose==='CUSTOMER_PASSWORD_RESET'&&customer&&!customer.portalRegistrationPending&&!customer.portalProfileIncomplete)return '/customer/password?reset=1';
 return '/customer';
}
