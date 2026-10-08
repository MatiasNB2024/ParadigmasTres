/* ==========================================================================
   jsperfilusuario.js - Perfil del usuario (perfilusuario.html)
   Antes este código estaba dentro de <script> en el HTML.
   ========================================================================== */
'use strict';

const $ = (selector) => document.querySelector(selector);

const CLAVE_PERFIL = 'userProfile';

/* Cargar datos del perfil desde localStorage */
function cargarPerfil() {
    const guardado = localStorage.getItem(CLAVE_PERFIL);
    if (!guardado) return;

    const userProfile = JSON.parse(guardado);
    $('#name').value = userProfile.name || '';
    $('#address').value = userProfile.address || '';
    $('#phone').value = userProfile.phone || '';
    $('#email').value = userProfile.email || '';
    $('#payment').value = userProfile.payment || 'tarjeta';
    $('#additionalInfo').value = userProfile.additionalInfo || '';
}

/* Guardar los datos del perfil en localStorage */
function guardarPerfil(evento) {
    evento.preventDefault();

    const userProfile = {
        name: $('#name').value,
        address: $('#address').value,
        phone: $('#phone').value,
        email: $('#email').value,
        payment: $('#payment').value,
        additionalInfo: $('#additionalInfo').value
    };

    localStorage.setItem(CLAVE_PERFIL, JSON.stringify(userProfile));
    alert('Perfil guardado exitosamente');
}

document.addEventListener('DOMContentLoaded', () => {
    cargarPerfil();
    $('#profileForm').addEventListener('submit', guardarPerfil);
});
