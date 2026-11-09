import { apiGet,apiPost } from '../../core/api.js';
const form=document.querySelector('#changeForm'),button=form.querySelector('button'),message=document.querySelector('#authMessage');
function notify(text,kind){message.textContent=text;message.className=`auth-message show ${kind}`;}
try{const me=await apiGet('/api/auth/me');if(me.role!=='STUDENT')document.querySelector('.auth-links a').href='/workspace.html';}catch{}
try{await apiGet('/api/auth/csrf');}catch{}
form.addEventListener('submit',async event=>{event.preventDefault();const currentPassword=form.elements.currentPassword.value,newPassword=form.elements.newPassword.value,confirm=form.elements.confirmPassword.value;if(newPassword.length<10)return notify('Mật khẩu mới cần có ít nhất 10 ký tự.','error');if(newPassword!==confirm)return notify('Hai mật khẩu mới chưa trùng khớp.','error');button.disabled=true;try{const result=await apiPost('/api/auth/change-password',{currentPassword,newPassword});notify(result.message,'success');form.reset();}catch(error){notify(error.message,'error');}finally{button.disabled=false;}});
