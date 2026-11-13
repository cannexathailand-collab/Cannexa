import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {employeeLanguageTools} from '../src/lib/employee-language';
import {resolveCustomerLanguage} from '../src/lib/customer-language';
import {OrderCommissionStatus} from '../src/app/my-performance/order-commission-status';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
test('employee UI starts in English and preserves an explicit Thai selection',()=>{
 assert.equal(employeeLanguageTools(resolveCustomerLanguage(undefined)).t('สร้างออเดอร์'),'Create order');
 assert.equal(employeeLanguageTools(resolveCustomerLanguage('th')).t('สร้างออเดอร์'),'สร้างออเดอร์');
 assert.equal(employeeLanguageTools('en').t('ภาพรวม'),'Overview');
 assert.equal(employeeLanguageTools('en').t(' รอตรวจสอบ '),' Awaiting review ');
});
test('employee translations leave customer names and product data intact',()=>{
 const {t}=employeeLanguageTools('en');
 assert.equal(t('คุณสมชาย ใจดี'),'คุณสมชาย ใจดี');
 assert.equal(t('AB01 / 10G / 500'),'AB01 / 10G / 500');
});
test('employee commission status renders English by default',()=>{
 const html=renderToStaticMarkup(createElement(OrderCommissionStatus,{visible:true,payment:'COD',codReceived:false,rows:[]}));
 assert.ok(html.includes('COD not received'));
 assert.ok(html.includes('Commission is not ready for calculation'));
 assert.ok(!html.includes('COD ยังไม่ได้รับเงิน'));
});

test('translated payment choices retain their canonical submitted values',()=>{
 const source=ts.createSourceFile('order-draft-builder.tsx',readFileSync(new URL('../src/app/my-performance/prepare/order-draft-builder.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const values:string[]=[];
 function visit(node:ts.Node){
  if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(source)==='option'&&node.children.some(child=>child.getText(source).includes('t('))){
   const value=node.openingElement.attributes.properties.find(attr=>ts.isJsxAttribute(attr)&&attr.name.getText(source)==='value');
   assert.ok(value&&ts.isJsxAttribute(value)&&value.initializer,'Translated options need an explicit value');
   if(ts.isJsxAttribute(value)&&value.initializer&&ts.isStringLiteral(value.initializer))values.push(value.initializer.text);
  }
  ts.forEachChild(node,visit);
 }
 visit(source);
 assert.ok(values.includes('โอน'));assert.ok(values.includes('เคลม'));
});
