import localFont from 'next/font/local';

const customerFont=localFont({
 src:'./fonts/noto-sans-thai.ttf',
 variable:'--font-customer',
 display:'swap',
});

export default function CustomerLayout({children}:{children:React.ReactNode}){
 return <div className={customerFont.variable+' customer-shell'}>{children}</div>;
}
