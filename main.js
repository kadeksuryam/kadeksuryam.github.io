// Function expression to select elements

const selectElement = (s) => document.querySelector(s);
const navLinks = document.querySelectorAll(".nav-link");

selectElement(".burger-menu-icon").addEventListener("click", ()=>{
    selectElement(".nav-list").classList.toggle("active");
    selectElement(".burger-menu-icon").classList.toggle("toggle");

    navLinks.forEach((link, index) => {
        if(link.style.animation){
            link.style.animation = "";
        }else{
            link.style.animation = `navLinkAnimate 0.5s ease forwards ${ index/7 + 0.5}s`
        }
    })
});

navLinks.forEach(link => {
    link.addEventListener("click", ()=>{
        selectElement(".nav-list").classList.toggle("active");
        selectElement(".burger-menu-icon").classList.toggle("toggle");
        navLinks.forEach((link, index) => {
            if(link.style.animation){
                link.style.animation = "";
            }else{
                link.style.animation = `navLinkAnimate 0.5s ease forwards ${ index/7 + 0.5}s`
            }
        })
    })
})


function openEmail(){
	window.open("mailto:kadeksuryam@gmail.com?subject=<edit the subject>");
}
function openFacebook(){
	window.open("https://www.facebook.com/surya.mahardika.184", "_blank");
}
function openInstagram(){
	window.open("https://www.instagram.com/suryam1729/", "_blank");
}
function openLinkedIn(){
	window.open("https://www.linkedin.com/in/kadek-surya-m-695256122/", "_blank");
}
function openGithub(){
	window.open("https://github.com/kadeksuryam", "_blank");
}
function openCV(){
	window.open("https://drive.google.com/file/d/1gohuTagj2stqAti1bkiBqW71vPD1dX78/view", "_blank");
}
function openProject1(){
	window.open("https://github.com/kadeksuryam/Algeo01-13519044", "_blank");
}
function openProject2(){
	window.open("https://github.com/kadeksuryam/Tubes_Daspro_IF1210", "_blank");
}
function openProject3(){
	window.open("https://github.com/kadeksuryam/Tubes_Daspro_IF1210", "_blank");
}