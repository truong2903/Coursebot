import { apiGet, apiPost } from '../../core/api.js';
const form=document.querySelector('#forgotForm'),button=form.querySelector('button'),message=document.querySelector('#authMessage');
function notify(text,kind){message.textContent=text;message.className=`auth-message show ${kind}`;}
try{await apiGet('/api/auth/csrf');}catch{}
form.addEventListener('submit',async event=>{event.preventDefault();const email=form.elements.email.value.trim();if(!email)return notify('Nhập email tài khoản.','error');button.disabled=true;button.textContent='Đang gửi…';try{const result=await apiPost('/api/auth/forgot-password',{email});sessionStorage.setItem('passwordResetEmail',email);notify(result.message,'success');form.reset();}catch(error){notify(error.message,'error');}finally{button.disabled=false;button.textContent='Gửi mã OTP';}});
