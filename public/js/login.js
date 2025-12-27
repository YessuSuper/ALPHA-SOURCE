// public/js/login.js

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
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
            console.log("Connexion réussie, gros zinzin !");
            
            // 🚨 FIX : NOUVEAU IDENTIFIANT SOURCE 🚨
            if (data.user && data.user.username) {
                localStorage.setItem('source_username', data.user.username);
            }
            
            if (data.first_login) {
                // Redirect to onboarding page
                window.location.href = '/pages/onboarding.html';
            } else {
                // Redirection vers la page principale du site
                window.location.href = data.redirect;
            }
        } else {
            if (data.redirect) {
                window.location.href = data.redirect;
            } else {
                // Statut 401 ou succès à false
                errorMessage.textContent = data.message || "Identifiants incorrects, espèce de gros zinzin.";
                errorMessage.style.display = 'block';
            }
        }

    } catch (error) {
        // Erreur de réseau (serveur non lancé, etc.)
        errorMessage.textContent = "Erreur de réseau. Le serveur n'est peut-être pas lancé. BORDEL.";
        errorMessage.style.display = 'block';
        console.error("Erreur de connexion :", error);
    }
});

let currentStep=1,guidePages=[],currentGuidePage=0;

function showOnboarding(u){
    console.log('ONBOARDING START for',u);
    document.getElementById('user-name').textContent=u;
    document.getElementById('login-container').style.display='none';
    let m=document.getElementById('onboarding-modal');
    m.style.display='flex';
    document.getElementById('validate-pic-btn').disabled=false;
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
            r.onload=(e)=>{
                document.getElementById('profile-preview').src=e.target.result;
                document.getElementById('profile-preview').style.display='block';
            };
            r.readAsDataURL(f);
        }
        document.getElementById('validate-pic-btn').disabled=false;
    };
    
    let vp=document.getElementById('validate-pic-btn');
    if(vp)vp.onclick=async()=>{
        let f=document.getElementById('profile-pic-input').files[0];
        if(f){
            let fd=new FormData();
            fd.append('avatar',f);
            fd.append('username',localStorage.getItem('source_username'));
            try{
                console.log('Upload avatar onboarding - File:', f);
                console.log('Upload avatar onboarding - Username:', localStorage.getItem('source_username'));
                let r=await fetch('/public/api/profile/upload-avatar',{method:'POST',body:fd});
                console.log('Upload response status:', r.status);
                let d=await r.json();
                console.log('Upload response data:', d);
                if(d.success){
                    console.log('Avatar uploaded successfully');
                    showStep(2);
                }else{
                    console.error('Upload failed:', d.message);
                    alert('Erreur upload: ' + (d.message || 'Erreur inconnue'));
                }
            }catch(e){
                console.error('Erreur upload onboarding:', e);
                alert('Erreur réseau lors de l\'upload');
            }
        }else showStep(2);
    };
    
    let bi=document.getElementById('birth-date-input');
    if(bi)bi.onchange=()=>{
        document.getElementById('validate-birth-btn').disabled=!bi.value;
    };
    
    let vb=document.getElementById('validate-birth-btn');
    if(vb)vb.onclick=async()=>{
        let bd=document.getElementById('birth-date-input').value;
        if(bd){
            try{
                let r=await fetch('/api/update-birth-date',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:localStorage.getItem('source_username'),birthDate:bd})});
                let d=await r.json();
                if(d.success)showStep(3);
            }catch(e){console.error(e);}
        }
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
                await loadGuide();
                showStep(4);
            }
        }catch(e){console.error(e);}
    };
    
    let prev=document.getElementById('prev-guide-btn');
    if(prev)prev.onclick=()=>{
        if(currentGuidePage>0){
            currentGuidePage--;
            showGuidePage(currentGuidePage);
        }
    };
    
    let next=document.getElementById('next-guide-btn');
    if(next)next.onclick=()=>{
        if(currentGuidePage<guidePages.length-1){
            currentGuidePage++;
            showGuidePage(currentGuidePage);
        }
    };
    
    let fin=document.getElementById('finish-onboarding-btn');
    if(fin)fin.onclick=()=>{
        window.location.href='/index.html';
    };
    
    let cls=document.getElementById('close-modal-btn');
    if(cls)cls.onclick=()=>{
        window.location.href='/index.html';
    };
}

async function loadGuide(){
    try{
        let r=await fetch('/api/guide');
        let d=await r.json();
        guidePages=d.pages||[{content:'<p>Bienvenue!</p>'}];
    }catch(e){
        guidePages=[{content:'<p>Guide indisponible</p>'}];
    }
    showGuidePage(0);
}

function showGuidePage(i){
    if(!guidePages||guidePages.length===0)return;
    let c=document.getElementById('guide-content');
    if(c)c.innerHTML=guidePages[i].content;
    let ind=document.getElementById('guide-indicator');
    if(ind)ind.textContent=`${i+1}/${guidePages.length}`;
    let pb=document.getElementById('prev-guide-btn');
    if(pb)pb.disabled=i===0;
    let nb=document.getElementById('next-guide-btn');
    if(nb)nb.style.display=i<guidePages.length-1?'inline':'none';
    let fb=document.getElementById('finish-onboarding-btn');
    if(fb)fb.style.display=i===guidePages.length-1?'inline':'none';
}

if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',initOnboarding);
}else{
    initOnboarding();
}