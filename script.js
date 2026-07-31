const formContacto = document.getElementById('form-contacto');

if (formContacto) {
    formContacto.addEventListener('submit', (evento) => {
        evento.preventDefault();
        window.location.href = 'gracias.html';
    })
}

const carrusel = document.getElementById('carrusel');
const btnAnterior = document.getElementById('btn-anterior');
const btnSiguiente = document.getElementById('btn-siguiente');

if (carrusel && btnAnterior && btnSiguiente) {
    const distanciaScroll = 300;

    btnSiguiente.addEventListener('click', () => {
        carrusel.scrollBy({ left: distanciaScroll, behavior: 'smooth' });
    });

    btnAnterior.addEventListener('click', () => {
        carrusel.scrollBy({ left: -distanciaScroll, behavior: 'smooth' });
    });
}
