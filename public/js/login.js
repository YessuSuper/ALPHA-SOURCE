// public/js/login.js

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Trim and remove invisible characters to avoid mismatch
    const rawUsername = document.getElementById('username').value || '';
    const username = rawUsername.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');
    
    // On masque les messages d'erreur précédents
    errorMessage.style.display = 'none';
    errorMessage.textContent = ''; 

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log("Connexion réussie !");
            
            // 🚨 FIX : NOUVEAU IDENTIFIANT SOURCE 🚨
            if (data.user && data.user.username) {
                localStorage.setItem('source_username', data.user.username);
            }

            // Afficher le tutoriel uniquement à la première connexion
            if (data.user && data.user.connexions === 1) {
                localStorage.removeItem('alpha_site_tutorial_seen');
            } else {
                localStorage.setItem('alpha_site_tutorial_seen', '1');
            }

            // Première connexion → afficher l'onboarding (pfp, anniversaire, mdp)
            if (data.first_login) {
                showOnboarding(data.user.username);
                return;
            }
            
            // Redirection vers la page principale du site
            window.location.href = data.redirect;
        } else {
            if (data.redirect) {
                // Stocker les infos du ban si présentes
                if (data.ban_until) {
                    localStorage.setItem('ban_until', data.ban_until);
                }
                if (data.ban_reason) {
                    localStorage.setItem('ban_reason', data.ban_reason);
                }
                window.location.href = data.redirect;
            } else {
                // Statut 401 ou succès à false
                errorMessage.textContent = data.message || "Identifiants incorrects.";
                errorMessage.style.display = 'block';
            }
        }

    } catch (error) {
        // Erreur de réseau (serveur non lancé, etc.)
        errorMessage.textContent = "Erreur de réseau. Le serveur n'est peut-être pas lancé.";
        errorMessage.style.display = 'block';
        console.error("Erreur de connexion :", error);
    }
});

let currentStep=1;

function showOnboarding(u){
    console.log('ONBOARDING START for',u);
    document.getElementById('user-name').textContent=u;
    document.getElementById('login-container').style.display='none';
    let m=document.getElementById('onboarding-container');
    m.style.display='block';
    showStep(1);
}

function showStep(s){
    console.log('STEP',s);
    document.querySelectorAll('.step').forEach(e=>e.style.display='none');
    let el=document.getElementById('step-'+s);
    if(el)el.style.display='block';
    currentStep=s;
}

function initOnboarding(){
    console.log('INIT ONBOARDING');
    let b=document.getElementById('choose-pic-btn');
    if(b)b.onclick=()=>document.getElementById('profile-pic-input').click();
    
    let p=document.getElementById('profile-pic-input');
    if(p)p.onchange=(e)=>{
        let f=e.target.files[0];
        if(f){
            let r=new FileReader();
            r.onload=(ev)=>{
                document.getElementById('profile-preview').src=ev.target.result;
                document.getElementById('profile-preview').style.display='block';
            };
            r.readAsDataURL(f);
        }
    };
    
    let vp=document.getElementById('validate-pic-btn');
    if(vp)vp.onclick=async()=>{
        let f=document.getElementById('profile-pic-input').files[0];
        if(f){
            let fd=new FormData();
            fd.append('avatar',f);
            fd.append('username',localStorage.getItem('source_username'));
            try{
                let r=await fetch('/public/api/profile/upload-avatar',{method:'POST',body:fd});
                let d=await r.json();
                if(d.success){
                    showStep(2);
                }else{
                    alert('Erreur upload: ' + (d.message || 'Erreur inconnue'));
                }
            }catch(e){
                console.error('Erreur upload onboarding:', e);
                alert('Erreur réseau');
            }
        }else showStep(2);
    };
    
    let sk=document.getElementById('skip-pic-btn');
    if(sk)sk.onclick=()=>showStep(2);
    
    // Remplir les selects jour/mois/année
    let dayS=document.getElementById('birth-day');
    let monthS=document.getElementById('birth-month');
    let yearS=document.getElementById('birth-year');
    const months=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    if(dayS){for(let i=1;i<=31;i++){let o=document.createElement('option');o.value=i;o.textContent=i;dayS.appendChild(o);}}
    if(monthS){months.forEach((m,i)=>{let o=document.createElement('option');o.value=i+1;o.textContent=m;monthS.appendChild(o);});}
    if(yearS){let cy=new Date().getFullYear();for(let y=cy;y>=cy-100;y--){let o=document.createElement('option');o.value=y;o.textContent=y;yearS.appendChild(o);}}
    
    let checkBirth=()=>{
        let d=dayS&&dayS.value, m=monthS&&monthS.value, y=yearS&&yearS.value;
        document.getElementById('validate-birth-btn').disabled=!(d&&m&&y);
    };
    if(dayS)dayS.onchange=checkBirth;
    if(monthS)monthS.onchange=checkBirth;
    if(yearS)yearS.onchange=checkBirth;
    
    let vb=document.getElementById('validate-birth-btn');
    if(vb)vb.onclick=async()=>{
        let d=dayS.value.padStart(2,'0'), m=monthS.value.padStart(2,'0'), y=yearS.value;
        let bd=`${y}-${m}-${d}`;
        try{
            let r=await fetch('/api/update-birth-date',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:localStorage.getItem('source_username'),birthDate:bd})});
            let res=await r.json();
            if(res.success)showStep(3);
        }catch(e){console.error(e);}
    };
    
    let chk=()=>{
        let p1=document.getElementById('new-password').value;
        let p2=document.getElementById('confirm-password').value;
        document.getElementById('validate-password-btn').disabled=!(p1&&p2&&p1===p2);
    };
    let np=document.getElementById('new-password');
    if(np)np.oninput=chk;
    let cp=document.getElementById('confirm-password');
    if(cp)cp.oninput=chk;
    
    let vpass=document.getElementById('validate-password-btn');
    if(vpass)vpass.onclick=async()=>{
        let pwd=document.getElementById('new-password').value;
        try{
            let r=await fetch('/api/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:localStorage.getItem('source_username'),newPassword:pwd})});
            let d=await r.json();
            if(d.success){
                window.location.href='/index.html';
            }
        }catch(e){console.error(e);}
    };
    
}

if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',initOnboarding);
}else{
    initOnboarding();
}