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

const tarjetasProyecto = document.querySelectorAll('.proyecto');

tarjetasProyecto.forEach(tarjeta => {
    tarjeta.addEventListener('mousemove', (evento) => {
        const rect = tarjeta.getBoundingClientRect();
        const x = evento.clientX - rect.left;
        const y = evento.clientY - rect.top;

        const centroX = rect.width / 2;
        const centroY = rect.height / 2;

        const rotarX = ((y - centroY) / centroY) * -8;
        const rotarY = ((x - centroX) / centroX) * 8;

        tarjeta.style.transform =
            `perspective(1000px) rotateX(${rotarX}deg) rotateY(${rotarY}deg) scale(1.03)`;
    });

    tarjeta.addEventListener('mouseleave', () => {
        tarjeta.style.transform =
            'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
    });
});