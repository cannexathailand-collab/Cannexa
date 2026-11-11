import {cookies} from 'next/headers';
import {readToken, signToken} from './crypto';

export const customerAgeCookie = 'customer_marketing_age';
export const customerAgeDuration = 600;
type CustomerAgeChallenge = {
  purpose: 'CUSTOMER_MARKETING_AGE';
  key: string;
  clickId: string;
  conversionId: string;
  lineVerified?: true;
  friendVerified?: true;
  exp: number;
};

export function customerAgeToken(key: string, clickId: string, conversionId: string, friendVerified=false) {
  return signToken({
    purpose: 'CUSTOMER_MARKETING_AGE',
    key,
    clickId,
    conversionId,
    lineVerified: true,
    ...(friendVerified?{friendVerified:true}:{}),
    exp: Date.now() + customerAgeDuration * 1000,
  });
}

export function readCustomerAgeToken(value: string) {
  const token = readToken<CustomerAgeChallenge>(value);
  if (
    token?.purpose !== 'CUSTOMER_MARKETING_AGE' ||
    (token.lineVerified !== true && token.friendVerified !== true) ||
    typeof token.key !== 'string' || !/^[a-f0-9]{64}$/.test(token.key) ||
    typeof token.clickId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(token.clickId) ||
    typeof token.conversionId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(token.conversionId) ||
    typeof token.exp !== 'number' || token.exp <= Date.now()
  ) return null;
  return token;
}

export async function customerAgeChallenge() {
  const value = (await cookies()).get(customerAgeCookie)?.value ?? '';
  const claims = readCustomerAgeToken(value);
  return claims ? {value, claims} : null;
}
