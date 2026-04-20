const isVoting = window.location.pathname === '/voting';

const header = document.querySelector('.header');

const navLeft = document.createElement('nav');
navLeft.className = 'header-left';

const exploreLink = document.createElement('a');
exploreLink.href = '/';
exploreLink.className = 'nav-link';
exploreLink.textContent = 'Home';
navLeft.appendChild(exploreLink);

if (!isVoting) {
    const votingLink = document.createElement('a');
    votingLink.href = '/voting';
    votingLink.className = 'nav-link';
    votingLink.textContent = 'Voting';
    navLeft.appendChild(votingLink);
}

const logoDiv = document.createElement('div');
logoDiv.className = 'header-logo';
const logoLink = document.createElement('a');
logoLink.href = '/';
const logoImg = document.createElement('img');
logoImg.src = '/assets/images/Eurovision_Cat_Contest_Logo_New.png';
logoImg.alt = 'ESC Cat Logo';
logoImg.className = 'logo-img';
logoLink.appendChild(logoImg);
logoDiv.appendChild(logoLink);

const rightDiv = document.createElement('div');
rightDiv.className = 'header-right';
const loginBtn = document.createElement('button');
loginBtn.className = 'login-btn';
loginBtn.textContent = 'Login';
loginBtn.onclick = () => window.location.href = '/login';
const signupBtn = document.createElement('button');
signupBtn.className = 'signup-btn';
signupBtn.textContent = 'Sign Up';
signupBtn.onclick = () => window.location.href = '/signup';
rightDiv.appendChild(loginBtn);
rightDiv.appendChild(signupBtn);

header.appendChild(navLeft);
header.appendChild(logoDiv);
header.appendChild(rightDiv);
