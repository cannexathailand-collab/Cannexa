'use client';
import {useCustomerLanguage} from '@/app/customer/language';
import {employeeLanguageTools} from '@/lib/employee-language';
export function useEmployeeLanguage(){return employeeLanguageTools(useCustomerLanguage().language);}
