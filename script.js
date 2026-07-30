const formContacto = document.getElementById('form-contacto');

if (formContacto) {
    formContacto.addEventListener('submit', (evento) => {
        evento.preventDefault();
        window.location.href = 'gracias.html';
    })
}