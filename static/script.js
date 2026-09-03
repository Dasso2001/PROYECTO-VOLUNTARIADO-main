// Categorías disponibles por sección 
const CATEGORIAS_DONACION = ["Ropa", "Calzado", "Muebles", "Electrónica", "Alimentos", "Libros", "Otros"];
const CATEGORIAS_SERVICIO = ["Plomería", "Electricista", "Jardinería", "Belleza", "Limpieza", "Clases particulares", "Otros"];
const CATEGORIAS_AYUDA = ["Emergencias", "Transporte", "Adultos mayores", "Mascotas", "Medicamentos", "Acompañamiento", "Otros"];

// Genera las opciones de un <select> a partir de una lista de categorías y la categoría actual
function opcionesCategorias(lista, categoriaActual) {
    return lista.map(c => `<option value="${c}" ${c === categoriaActual ? "selected" : ""}>${c}</option>`).join("");
}

// Imagen predeterminada según el tipo de publicación, para cuando el usuario no sube ninguna
function imagenPorDefecto(tipo) {
    if (tipo === "ayuda") return "/static/imagenes/default_ayuda.webp";
    if (tipo === "servicio") return "/static/imagenes/default_servicio.webp";
    if (tipo === "donacion") return "/static/imagenes/default_donacion.webp";
    return null;
}

// Abre el detalle de una publicación. En "ver donaciones/servicios/ayuda"
function irADetallePublicacion(tipo, id) {
    if (document.querySelector(".dashboard-page")) {
        const rutasSeccion = {
            donacion: "/donaciones/ver",
            servicio: "/servicios/ver",
            ayuda: "/ayuda/ver"
        };
        const ruta = rutasSeccion[tipo];
        if (ruta) {
            window.location.href = `${ruta}?item=${id}`;
            return;
        }
    }

    const listas = [
        document.getElementById("lista"),
        document.getElementById("lista-servicios"),
        document.getElementById("lista-ayuda"),
        document.getElementById("lista-publicaciones")
    ].filter(Boolean);

    let tarjeta = null;
    for (const lista of listas) {
        tarjeta = Array.from(lista.children).find(el =>
            Number(el.dataset.id) === Number(id) &&
            (!el.dataset.tipo || el.dataset.tipo === tipo)
        );
        if (tarjeta) break;
    }

    if (!tarjeta) {
        window.location.href = `/publicacion/${tipo}/${id}`;
        return;
    }

    const panel = tarjeta.closest(".panel-lista");
    if (panel) {
        mostrarDetalleEnCaja(panel, tipo, id);
        return;
    }

    const busqueda = tarjeta.closest(".busqueda-container");
    if (!busqueda) {
        window.location.href = `/publicacion/${tipo}/${id}`;
        return;
    }
    mostrarDetalleReemplazando(busqueda, tipo, id);
}

// Abre una publicación relacionada
function abrirPublicacionRelacionada(elemento, tipo, id) {
    const panel = elemento.closest(".panel-lista");
    if (panel) {
        mostrarDetalleEnCaja(panel, tipo, id);
        return;
    }

    const busqueda = elemento.closest(".busqueda-container");
    if (busqueda) {
        mostrarDetalleReemplazando(busqueda, tipo, id);
        return;
    }

    const modalActual = elemento.closest(".modal-detalle-publicacion-overlay");
    if (modalActual) {
        modalActual.remove();
        mostrarDetalleModal(tipo, id);
        return;
    }

    irADetallePublicacion(tipo, id);
}

// "Ver donaciones/servicios/ayuda": abre el detalle dentro del mismo recuadro 
function mostrarDetalleEnCaja(panel, tipo, id) {
    const panelInner = panel.querySelector(".panel-lista-inner");
    const caja = panel.querySelector(".detalle-publicacion-box");
    if (!caja) {
        window.location.href = `/publicacion/${tipo}/${id}`;
        return;
    }

    fetch("/api/publicaciones")
        .then(res => res.json())
        .then(publicaciones => {
            const p = publicaciones.find(item =>
                item.tipo === tipo && Number(item.id) === Number(id)
            );

            if (!p) {
                window.location.href = `/publicacion/${tipo}/${id}`;
                return;
            }

            caja.innerHTML = construirDetalleEmbebido(p);
            caja.classList.add("abierta");
            panel.classList.add("mostrando-detalle");
            caja.scrollTop = 0;
            activarVerMasDescripcion(caja, p.titulo, p.descripcion);

            const listaMasPublicaciones = caja.querySelector(".detalle-embebido-mas-publicaciones .mas-publicaciones-mini-fila");
            if (listaMasPublicaciones) {
                const otras = publicaciones.filter(item =>
                    item.user_id === p.user_id &&
                    item.tipo === p.tipo &&
                    item.id !== p.id
                );
                listaMasPublicaciones.innerHTML = otras.length === 0
                    ? `<p class="mas-publicaciones-vacio">No tiene más publicaciones en esta sección.</p>`
                    : otras.map(item => htmlTarjetaMasPublicacionesMini(item)).join("");
            }

            const cerrar = caja.querySelector(".detalle-embebido-cerrar");
            if (cerrar) {
                cerrar.addEventListener("click", () => {
                    caja.classList.remove("abierta");
                    caja.innerHTML = "";
                    panel.classList.remove("mostrando-detalle");
                });
            }

            const botonContactar = caja.querySelector(".detalle-embebido-contactar");
            if (botonContactar) {
                botonContactar.addEventListener("click", event => {
                    event.stopPropagation();
                    abrirModalContacto(
                        p.user_id,
                        p.usuario,
                        p.tipo,
                        p.id,
                        p.titulo,
                        p.imagen || null
                    );
                });
            }
        })
        .catch(() => {
            window.location.href = `/publicacion/${tipo}/${id}`;
        });
}

function mostrarDetalleReemplazando(campo, tipo, id) {
    fetch("/api/publicaciones")
        .then(res => res.json())
        .then(publicaciones => {
            const p = publicaciones.find(item =>
                item.tipo === tipo && Number(item.id) === Number(id)
            );

            if (!p) {
                window.location.href = `/publicacion/${tipo}/${id}`;
                return;
            }

            const contenidoAnterior = campo.innerHTML;
            campo.classList.add("viendo-detalle");
            campo.innerHTML = construirDetalleEmbebido(p);
            activarVerMasDescripcion(campo, p.titulo, p.descripcion);

            const listaMasPublicaciones = campo.querySelector(".detalle-embebido-mas-publicaciones .mas-publicaciones-mini-fila");
            if (listaMasPublicaciones) {
                const otras = publicaciones.filter(item =>
                    item.user_id === p.user_id &&
                    item.tipo === p.tipo &&
                    item.id !== p.id
                );
                listaMasPublicaciones.innerHTML = otras.length === 0
                    ? `<p class="mas-publicaciones-vacio">No tiene más publicaciones en esta sección.</p>`
                    : otras.map(item => htmlTarjetaMasPublicacionesMini(item)).join("");
            }

            const cerrar = campo.querySelector(".detalle-embebido-cerrar");
            if (cerrar) {
                cerrar.addEventListener("click", () => {
                    campo.innerHTML = contenidoAnterior;
                    campo.classList.remove("viendo-detalle");
                    cargarPublicacionesGlobales();
                });
            }

            const botonContactar = campo.querySelector(".detalle-embebido-contactar");
            if (botonContactar) {
                botonContactar.addEventListener("click", event => {
                    event.stopPropagation();
                    abrirModalContacto(
                        p.user_id,
                        p.usuario,
                        p.tipo,
                        p.id,
                        p.titulo,
                        p.imagen || null
                    );
                });
            }
        })
        .catch(() => {
            window.location.href = `/publicacion/${tipo}/${id}`;
        });
}

// Convierte una fecha en texto relativo tipo "hace 2 días"
function tiempoRelativo(fechaISO) {
    if (!fechaISO) return "";
    const segundos = (Date.now() - new Date(fechaISO).getTime()) / 1000;
    if (segundos < 60) return "Publicado recién";
    const minutos = Math.floor(segundos / 60);
    if (minutos < 60) return `Publicado hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Publicado hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    if (dias === 1) return "Publicado hace 1 día";
    if (dias < 30) return `Publicado hace ${dias} días`;
    const meses = Math.floor(dias / 30);
    if (meses === 1) return "Publicado hace 1 mes";
    return `Publicado hace ${meses} meses`;
}

function construirDetalleEmbebido(p) {
    const imagen = p.imagen
        ? `/static/uploads/${p.imagen}`
        : imagenPorDefecto(p.tipo);

    const tipoTexto = p.tipo === "donacion"
        ? "Donación"
        : p.tipo === "servicio"
            ? "Servicio"
            : "Ayuda";

    const botonesPropios = p.es_mia
        ? `<div class="tarjeta-boton detalle-embebido-botones">
                <button class="btn-contacto" onclick="event.stopPropagation(); marcarConcretadaDesdeDetalle(this)"
                    data-tipo="${p.tipo}" data-id="${p.id}" data-concretada="${p.concretada ? "true" : "false"}">
                    ${p.concretada ? "Marcar como no concretada" : "Marcar como concretada"}
                </button>
                <button class="btn-editar" onclick="event.stopPropagation(); editarDesdeDetalle(this)"
                    data-tipo="${p.tipo}" data-id="${p.id}">Editar</button>
                <button class="btn-eliminar" onclick="event.stopPropagation(); eliminarDesdeDetalle(this)"
                    data-tipo="${p.tipo}" data-id="${p.id}">Eliminar</button>
           </div>`
        : "";

    const fotoUsuario = p.usuario_foto
        ? `<img src="/static/uploads/${p.usuario_foto}" alt="${escapeApos(p.usuario)}">`
        : (p.usuario ? p.usuario[0].toUpperCase() : "?");

    const cantidadPublicaciones = p.usuario_publicaciones || 0;
    const textoPublicaciones = `${cantidadPublicaciones} publicaci${cantidadPublicaciones === 1 ? "ón" : "ones"} en AportAR`;

    const botonCorreo = (!p.es_mia && p.usuario_email)
        ? `<button type="button" class="btn-correo" title="Enviar un correo a ${escapeApos(p.usuario)}" aria-label="Enviar un correo a ${escapeApos(p.usuario)}"
                onclick="abrirModalCorreo(${p.user_id}, '${escapeApos(p.usuario)}', '${escapeApos(p.titulo || "")}')">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                    <path d="m22 6-10 7L2 6"></path>
                </svg>
           </button>`
        : "";

    const botonEscribir = p.es_mia
        ? ""
        : `<div class="detalle-pagina-usuario-acciones">
                ${botonCorreo}
                <button type="button" class="btn-contacto detalle-embebido-contactar">Escribir</button>
           </div>`;

    const fecha = tiempoRelativo(p.fecha_creacion);

    return `
        <div class="detalle-embebido">
            <button type="button" class="detalle-embebido-cerrar" aria-label="Volver">&times;</button>

            <div class="detalle-embebido-imagen">
                <img src="${imagen}" alt="${p.titulo}">
            </div>

            <div class="detalle-embebido-info detalle-pagina-info"
                 data-tipo="${p.tipo}"
                 data-id="${p.id}"
                 data-user-id="${p.user_id}"
                 data-usuario="${escapeApos(p.usuario)}"
                 data-titulo="${escapeApos(p.titulo)}"
                 data-descripcion="${escapeApos(p.descripcion)}"
                 data-ubicacion="${escapeApos(p.ubicacion)}"
                 data-categoria="${escapeApos(p.categoria || "")}"
                 data-contacto="${escapeApos(p.contacto || "")}"
                 data-imagen="${escapeApos(p.imagen || "")}"
                 data-urgente="${p.urgente ? "true" : "false"}"
                 data-concretada="${p.concretada ? "true" : "false"}">
                <div class="detalle-pagina-titulo-row">
                    <h2>${p.titulo}</h2>
                    <span class="chip-categoria">${p.categoria || tipoTexto}</span>
                    ${p.urgente ? `<span class="badge-urgente">⚠ Urgente</span>` : ""}
                    ${p.concretada ? `<span class="badge-concretada">Concretada</span>` : ""}
                </div>

                <div class="detalle-pagina-chips">
                    <span class="chip-dato">📍 ${p.ubicacion || ""}</span>
                    ${fecha ? `<span class="chip-dato">🕒 ${fecha}</span>` : ""}
                    ${p.contacto ? `<span class="chip-dato">☎ ${p.contacto}</span>` : ""}
                </div>

                <div class="detalle-embebido-datos">
                    <h4 class="detalle-embebido-datos-titulo">Descripción</h4>
                    <small class="detalle-embebido-descripcion">${p.descripcion || ""}</small>
                </div>

                <div class="detalle-pagina-usuario">
                    <div class="detalle-pagina-usuario-avatar">${fotoUsuario}</div>
                    <div class="detalle-pagina-usuario-info">
                        <strong>${escapeApos(p.usuario) || ""}</strong>
                        <small>${textoPublicaciones}</small>
                    </div>
                    ${botonEscribir}
                </div>

                ${botonesPropios}

                <div class="detalle-embebido-mas-publicaciones">
                    <h3 class="mas-publicaciones-titulo">Más publicaciones de ${escapeApos(p.usuario) || ""}</h3>
                    <div class="mas-publicaciones-mini-fila">
                        <p class="mas-publicaciones-vacio">Cargando...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Escapa comillas simples para insertar texto de forma segura
function escapeApos(str) {
    return (str || "").replace(/'/g, "\\'");
}

function escapeHtml(str) {
    return (str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Modal genérico para mostrar contenido largo 
function abrirModalDescripcion(titulo, descripcion) {
    const overlay = document.getElementById("modal-detalle-overlay");
    const contenido = document.getElementById("modal-detalle-contenido");
    if (!overlay || !contenido) return;

    contenido.innerHTML = `
        <span class="modal-detalle-cerrar" onclick="cerrarModalDetalle()">&times;</span>
        <h3 class="modal-detalle-titulo">${escapeHtml(titulo)}</h3>
        <p class="modal-detalle-texto">${escapeHtml(descripcion)}</p>
    `;
    overlay.classList.add("activo");
}

function cerrarModalDetalle() {
    const overlay = document.getElementById("modal-detalle-overlay");
    if (overlay) overlay.classList.remove("activo");
}

// Límite de caracteres para mostrar la descripción en la caja de detalle antes de mostrar el botón "Ver más"
const LIMITE_DESCRIPCION_CAJA = 170;

function activarVerMasDescripcion(contenedor, titulo, descripcionCompleta) {
    if (!contenedor || !descripcionCompleta) return;
    if (descripcionCompleta.length <= LIMITE_DESCRIPCION_CAJA) return;

    const caja = contenedor.querySelector(".detalle-embebido-datos");
    if (!caja) return;

    const boton = document.createElement("span");
    boton.className = "detalle-embebido-vermas";
    boton.textContent = "Ver más";
    boton.addEventListener("click", event => {
        event.stopPropagation();
        abrirModalDescripcion(titulo, descripcionCompleta);
    });
    caja.appendChild(boton);
}

function iconoChatHtml(tipo, item) {
    if (item.es_mia) return "";
    const imagenArg = item.imagen ? `'${item.imagen}'` : "null";
    return `
        <button type="button" class="tarjeta-icono-chat" title="Escribirle a ${escapeApos(item.usuario)}"
            onclick="event.stopPropagation(); abrirModalContacto(${item.user_id}, '${escapeApos(item.usuario)}', '${tipo}', ${item.id}, '${escapeApos(item.titulo)}', ${imagenArg})">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1b2a41" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
        </button>
    `;
}

function htmlTarjetaPublicacion(p) {
    const clase = p.tipo === "donacion" ? "donacion" : "servicios_ayuda";
    const claseFinal = (p.tipo === "ayuda" && p.urgente) ? `${clase} tarjeta-urgente` : clase;

    const imagenSola = p.imagen
        ? `<img src="/static/uploads/${p.imagen}" style="cursor:pointer;" onclick="irADetallePublicacion('${p.tipo}', ${p.id})">`
        : `<img src="${imagenPorDefecto(p.tipo)}" style="cursor:pointer;" onclick="irADetallePublicacion('${p.tipo}', ${p.id})">`;
    const imagenHtml = `<div class="tarjeta-imagen-wrap">${imagenSola}${iconoChatHtml(p.tipo, p)}</div>`;

    const tituloHtml = p.tipo === "ayuda"
        ? `<div class="titulo-ayuda-row">
                <h3 onclick="irADetallePublicacion('${p.tipo}', ${p.id})" style="cursor:pointer;">${p.titulo}</h3>
                ${p.urgente ? `<span class="badge-urgente">⚠ Urgente</span>` : ""}
           </div>`
        : `<h3 onclick="irADetallePublicacion('${p.tipo}', ${p.id})" style="cursor:pointer;">${p.titulo}</h3>`;

    const botonesHtml = p.es_mia
        ? (p.tipo === "donacion"
            ? `<button onclick="mostrarFormularioEdicion(${p.id}, '${escapeApos(p.titulo)}', '${escapeApos(p.descripcion)}', '${escapeApos(p.ubicacion)}', '${escapeApos(p.categoria || "")}')" class="btn-editar">Editar</button>
               <button onclick="eliminarDonacion(${p.id})" class="btn-eliminar">Eliminar</button>`
            : p.tipo === "servicio"
                ? `<button onclick="mostrarFormularioEdicionServicio(${p.id}, '${escapeApos(p.titulo)}', '${escapeApos(p.descripcion)}', '${escapeApos(p.ubicacion)}', '${escapeApos(p.contacto)}', '${escapeApos(p.categoria || "")}')" class="btn-editar">Editar</button>
                   <button onclick="eliminarServicio(${p.id})" class="btn-eliminar">Eliminar</button>`
                : `<button onclick="mostrarFormularioEdicionAyuda(${p.id}, '${escapeApos(p.titulo)}', '${escapeApos(p.descripcion)}', '${escapeApos(p.ubicacion)}', '${escapeApos(p.contacto)}', '${escapeApos(p.categoria || "")}', ${p.urgente ? "true" : "false"})" class="btn-editar">Editar</button>
                   <button onclick="eliminarAyuda(${p.id})" class="btn-eliminar">Eliminar</button>`)
        : `<button onclick="abrirModalContacto(${p.user_id}, '${escapeApos(p.usuario)}', '${p.tipo}', ${p.id}, '${escapeApos(p.titulo)}', ${p.imagen ? `'${p.imagen}'` : "null"})" class="btn-contacto">Contactar</button>`;

    const LIMITE_DESCRIPCION = 55;
    const descripcionLarga = p.descripcion && p.descripcion.length > LIMITE_DESCRIPCION;
    const descripcionCorta = descripcionLarga
        ? p.descripcion.slice(0, LIMITE_DESCRIPCION).trim() + "…"
        : p.descripcion;
    const verMasHtml = descripcionLarga
        ? ` <span onclick="event.stopPropagation(); irADetallePublicacion('${p.tipo}', ${p.id})" class="mas-publicaciones-vermas">Ver más</span>`
        : "";

    return `
        <div class="${claseFinal}">
            ${tituloHtml}
            ${imagenHtml}
            <small><strong>Descripción:</strong> ${descripcionCorta}${verMasHtml}</small>
            <small><strong>Ubicación:</strong> ${p.ubicacion}</small>
            ${p.categoria ? `<small><strong>Categoría:</strong> ${p.categoria}</small>` : ""}
            ${p.contacto ? `<small><strong>Contacto:</strong> ${p.contacto}</small>` : ""}
            <small><strong>Publicado por:</strong> ${p.usuario}</small>
            <div class="tarjeta-boton">${botonesHtml}</div>
        </div>
    `;
}

// Saca acentos/tildes y pasa a minúsculas, para que el buscador y los filtros
// no distingan mayúsculas de minúsculas ni "a" de "á"
function htmlTarjetaMasPublicaciones(p) {
    const imagenSrc = p.imagen ? `/static/uploads/${p.imagen}` : imagenPorDefecto(p.tipo);
    const categoriaHtml = p.categoria
        ? `<small><strong>Categoría:</strong> ${p.categoria}</small>`
        : "";

    return `
        <div class="mas-publicaciones-card">
            <div class="mas-publicaciones-card-cabecera" onclick="irADetallePublicacion('${p.tipo}', ${p.id})">
                <img src="${imagenSrc}" alt="${escapeApos(p.titulo)}">
                <h4>${p.titulo}</h4>
            </div>
            <div class="mas-publicaciones-card-detalle">
                <small><strong>Descripción:</strong> ${p.descripcion || ""}</small>
                ${categoriaHtml}
            </div>
            <button type="button" class="mas-publicaciones-vercard" onclick="toggleMasPublicacionesCard(this)">Ver</button>
        </div>
    `;
}

function toggleMasPublicacionesCard(boton) {
    const tarjeta = boton.closest(".mas-publicaciones-card");
    const expandida = tarjeta.classList.toggle("mas-publicaciones-card-expandida");
    boton.textContent = expandida ? "Ocultar" : "Ver";
}

// Tarjeta chica (imagen + botón "Ver") de "Más publicaciones de {usuario}" dentro de la caja de detalle 
// (ver donaciones/servicios/ayuda). Al tocar la imagen o el botón, abre esa publicación en la misma caja.
function htmlTarjetaMasPublicacionesMini(p) {
    const imagenSrc = p.imagen ? `/static/uploads/${p.imagen}` : imagenPorDefecto(p.tipo);

    return `
        <div class="mas-publicaciones-mini" onclick="abrirPublicacionRelacionada(this, '${p.tipo}', ${p.id})" title="${escapeApos(p.titulo)}">
            <div class="mas-publicaciones-mini-imagen">
                <img src="${imagenSrc}" alt="${escapeApos(p.titulo)}">
            </div>
            <button type="button" class="btn-ver-publicacion mas-publicaciones-mini-ver"
                onclick="event.stopPropagation(); abrirPublicacionRelacionada(this, '${p.tipo}', ${p.id})">Ver</button>
        </div>
    `;
}

function normalizarTexto(str) {
    return (str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

document.addEventListener("DOMContentLoaded", () => {
    window.currentUserId = parseInt(document.body.dataset.userId || "0", 10);

    // Menu desplegable lateral
    const menuHeaders = document.querySelectorAll(".menu-header");
    menuHeaders.forEach(header => {
        header.addEventListener("click", function () {
            const menuItem = this.parentElement;
            const isActive = menuItem.classList.contains("active");

            // Cierra todos los menus
            document.querySelectorAll(".menu-item").forEach(item => {
                item.classList.remove("active");
                const span = item.querySelector(".menu-header span");
                if (span) span.textContent = span.textContent.replace(" [-]", " [+]");
            });

            if (!isActive) {
                menuItem.classList.add("active");
                const span = this.querySelector("span");
                if (span) span.textContent = span.textContent.replace(" [+]", " [-]");
            }
        });

        // Agrega el signo "[+]" a todos los encabezados
        const span = header.querySelector("span");
        if (span && !span.textContent.includes("[+]")) {
            span.textContent += " [+]";
        }
    });

    // Funcion para cargar y mostrar datos vía API
    // Solo muestra las publicaciones de OTROS usuarios 
    // y permite filtrarlas por texto, distrito y categoría, y ordenarlas por fecha
    function cargarYMostrar(url, contenedorId, renderItem) {
        const contenedor = document.getElementById(contenedorId);
        if (!contenedor) return;

        function render(lista) {
            contenedor.innerHTML = "";
            if (lista.length === 0) {
                const mensajeVacio = renderItem.vacioMensaje || "No hay publicaciones disponibles.";
                contenedor.innerHTML = `<p class="sin-resultados">${mensajeVacio}</p>`;
                return;
            }
            lista.forEach(item => {
                const div = document.createElement("div");
                const clase = typeof renderItem.className === "function"
                    ? renderItem.className(item)
                    : renderItem.className;
                div.className = clase || "";
                div.dataset.id = item.id;
                div.dataset.tipo = renderItem.tipo || item.tipo || "";
                div.innerHTML = renderItem.html(item);
                div.addEventListener("click", event => {
                    if (event.target.closest("button")) return;
                    if (event.target.closest(".mas-publicaciones-vermas")) return;
                    irADetallePublicacion(renderItem.tipo || item.tipo, item.id);
                });
                contenedor.appendChild(div);
            });
        }

        function aplicarFiltrosYOrden(itemsDeOtros) {
            const inputBusqueda = renderItem.buscadorId ? document.getElementById(renderItem.buscadorId) : null;
            const selectDistrito = renderItem.distritoId ? document.getElementById(renderItem.distritoId) : null;
            const selectCategoria = renderItem.categoriaId ? document.getElementById(renderItem.categoriaId) : null;
            const selectOrden = renderItem.ordenId ? document.getElementById(renderItem.ordenId) : null;
            const checkboxUrgente = renderItem.urgenteId ? document.getElementById(renderItem.urgenteId) : null;

            const termino = inputBusqueda ? normalizarTexto(inputBusqueda.value.trim()) : "";
            const distrito = selectDistrito ? selectDistrito.value : "";
            const categoria = selectCategoria ? selectCategoria.value : "";
            const orden = selectOrden ? selectOrden.value : "recientes";
            const soloUrgentes = checkboxUrgente ? checkboxUrgente.checked : false;

            let resultado = itemsDeOtros.filter(item => {
                if (distrito && item.ubicacion !== distrito) return false;
                if (categoria && item.categoria !== categoria) return false;
                if (soloUrgentes && !item.urgente) return false;
                if (termino) {
                    const texto = normalizarTexto(`${item.titulo} ${item.descripcion} ${item.ubicacion || ""} ${item.categoria || ""} ${item.usuario || ""}`);
                    if (!texto.includes(termino)) return false;
                }
                return true;
            });

            resultado = resultado.slice().sort((a, b) => {
                // Las solicitudes de ayuda marcadas como urgentes van primero
                const urgenteA = a.urgente ? 1 : 0;
                const urgenteB = b.urgente ? 1 : 0;
                if (urgenteA !== urgenteB) return urgenteB - urgenteA;

                const fechaA = new Date(a.fecha_creacion).getTime() || 0;
                const fechaB = new Date(b.fecha_creacion).getTime() || 0;
                return orden === "antiguas" ? fechaA - fechaB : fechaB - fechaA;
            });

            render(resultado);
        }

        fetch(url)
            .then(res => res.json())
            .then(items => {
                // Solo publicaciones de otros usuarios
                const itemsDeOtros = items.filter(item => !item.es_mia);

                aplicarFiltrosYOrden(itemsDeOtros);

                // Conecta buscador y filtros (si la vista los tiene configurados)
                [renderItem.buscadorId, renderItem.distritoId, renderItem.categoriaId, renderItem.ordenId, renderItem.urgenteId]
                    .filter(Boolean)
                    .forEach(id => {
                        const el = document.getElementById(id);
                        if (!el) return;
                        const evento = (el.tagName === "SELECT" || el.type === "checkbox") ? "change" : "input";
                        el.addEventListener(evento, () => aplicarFiltrosYOrden(itemsDeOtros));
                    });
            })
            .catch(() => {
                contenedor.innerHTML = "<p>Error al cargar los datos.</p>";
            });
    }

    // Pantalla de detalle de una publicación: muestra otras publicaciones del mismo usuario en la parte inferior
    const contenedorMasPublicaciones = document.getElementById("mas-publicaciones-usuario");
    if (contenedorMasPublicaciones) {
        const usuarioId = parseInt(contenedorMasPublicaciones.dataset.usuarioId, 10);
        const tipoActual = contenedorMasPublicaciones.dataset.tipoActual;
        const idActual = parseInt(contenedorMasPublicaciones.dataset.idActual, 10);

        const lista = document.getElementById("mas-publicaciones-scroll");

        fetch("/api/publicaciones")
            .then(res => res.json())
            .then(datos => {
                const otras = datos.filter(p =>
                    p.user_id === usuarioId &&
                    p.tipo === tipoActual &&
                    p.id !== idActual
                );

                lista.innerHTML = otras.length === 0
                    ? `<p class="mas-publicaciones-vacio">No tiene más publicaciones en esta sección.</p>`
                    : otras.map(p => htmlTarjetaMasPublicaciones(p)).join("");
            })
            .catch(() => {});
    }

    // Pantalla de detalle: chat embebido con el dueño de la publicación
    inicializarChatDetalle();

    // Carga de datos para Donaciones
    cargarYMostrar("/api/donaciones", "lista", {
        className: "donacion",
        tipo: "donacion",
        buscadorId: "buscador-donaciones",
        distritoId: "filtro-distrito-donaciones",
        categoriaId: "filtro-categoria-donaciones",
        ordenId: "orden-donaciones",
        vacioMensaje: "No se encontraron donaciones de vecinos.",
        html: d => `
            <div class="tarjeta-imagen-wrap">
                ${d.imagen
                    ? `<img src="/static/uploads/${d.imagen}" alt="Publicación" >`
                    : `<img src="${imagenPorDefecto('donacion')}" alt="Publicación">`}
            </div>
            <div class="tarjeta-info">
                <h3 class="tarjeta-titulo">${d.titulo}</h3>
                <small class="tarjeta-publicado-por"><strong>Publicado por:</strong> ${d.usuario}</small>
                <div class="tarjeta-boton">
                    <button type="button" class="btn-ver-publicacion"
                        onclick="event.stopPropagation(); irADetallePublicacion('donacion', ${d.id})">
                        Ver
                    </button>
                </div>
            </div>
        `
    });

    // Carga de datos para Servicios
    cargarYMostrar("/api/servicios", "lista-servicios", {
        className: "servicios_ayuda",
        tipo: "servicio",
        buscadorId: "buscador-servicios",
        distritoId: "filtro-distrito-servicios",
        categoriaId: "filtro-categoria-servicios",
        ordenId: "orden-servicios",
        vacioMensaje: "No se encontraron servicios de vecinos.",
        html: s => `
            <div class="tarjeta-imagen-wrap">
                ${s.imagen
                    ? `<img src="/static/uploads/${s.imagen}" alt="Publicación">`
                    : `<img src="${imagenPorDefecto('servicio')}" alt="Publicación">`}
            </div>
            <div class="tarjeta-info">
                <h3 class="tarjeta-titulo">${s.titulo}</h3>
                <small class="tarjeta-publicado-por"><strong>Publicado por:</strong> ${s.usuario}</small>
                <div class="tarjeta-boton">
                    <button type="button" class="btn-ver-publicacion"
                        onclick="event.stopPropagation(); irADetallePublicacion('servicio', ${s.id})">
                        Ver
                    </button>
                </div>
            </div>
        `
    });

    // Carga de datos para Ayuda
    cargarYMostrar("/api/ayuda", "lista-ayuda", {
        className: a => "servicios_ayuda" + (a.urgente ? " tarjeta-urgente" : ""),
        tipo: "ayuda",
        buscadorId: "buscador-ayuda",
        distritoId: "filtro-distrito-ayuda",
        categoriaId: "filtro-categoria-ayuda",
        ordenId: "orden-ayuda",
        urgenteId: "filtro-urgente-ayuda",
        vacioMensaje: "No se encontraron pedidos de ayuda.",
        html: a => `
            <div class="tarjeta-imagen-wrap">
                ${a.imagen
                    ? `<img src="/static/uploads/${a.imagen}" alt="Publicación">`
                    : `<img src="${imagenPorDefecto('ayuda')}" alt="Publicación">`}
            </div>
            <div class="tarjeta-info">
                <div class="titulo-ayuda-row">
                    <h3 class="tarjeta-titulo">${a.titulo}</h3>
                    ${a.urgente ? `<span class="badge-urgente">⚠ Urgente</span>` : ""}
                </div>
                <small class="tarjeta-publicado-por"><strong>Publicado por:</strong> ${a.usuario}</small>
                <div class="tarjeta-boton">
                    <button type="button" class="btn-ver-publicacion"
                        onclick="event.stopPropagation(); irADetallePublicacion('ayuda', ${a.id})">
                        Ver
                    </button>
                </div>
            </div>
        `
    });

    // Si la URL tiene un parámetro "item", abre el detalle de esa publicación
    const parametroItem = new URLSearchParams(window.location.search).get("item");
    if (parametroItem) {
        const idItem = Number(parametroItem);
        const mapaListasSeccion = [
            { id: "lista", tipo: "donacion" },
            { id: "lista-servicios", tipo: "servicio" },
            { id: "lista-ayuda", tipo: "ayuda" }
        ];
        for (const { id: listaId, tipo } of mapaListasSeccion) {
            const lista = document.getElementById(listaId);
            if (lista) {
                const panel = lista.closest(".panel-lista");
                if (panel) mostrarDetalleEnCaja(panel, tipo, idItem);
                break;
            }
        }
    }

    // Carga de Publicaciones Globales (Busqueda avanzada)
    const buscadorGlobal = document.getElementById("buscador-global");
    const filtroDistritoGlobal = document.getElementById("filtro-distrito-global");
    const ordenGlobal = document.getElementById("orden-global");

    function aplicarBusquedaGlobal() {
        cargarPublicacionesGlobales(
            buscadorGlobal ? buscadorGlobal.value : "",
            filtroDistritoGlobal ? filtroDistritoGlobal.value : "",
            ordenGlobal ? ordenGlobal.value : "recientes"
        );
    }

    if (document.getElementById("lista-publicaciones")) aplicarBusquedaGlobal();

    if (buscadorGlobal) buscadorGlobal.addEventListener("input", aplicarBusquedaGlobal);
    if (filtroDistritoGlobal) filtroDistritoGlobal.addEventListener("change", aplicarBusquedaGlobal);
    if (ordenGlobal) ordenGlobal.addEventListener("change", aplicarBusquedaGlobal);

    // Cargar la cantidad de mensajes no leídos para el contador superior
    cargarCantidadMensajes();

    // Carga la bandeja de mensajes (solo existe en /mensajes)
    cargarMensajes();
});

// FUNCIONES DE PUBLICACION
function publicar() {
    const formData = new FormData();
    formData.append("titulo", document.getElementById("titulo").value);
    formData.append("descripcion", document.getElementById("descripcion").value);
    formData.append("ubicacion", document.getElementById("ubicacion").value);
    formData.append("categoria", document.getElementById("categoria").value);
    
    const imagenInput = document.getElementById("imagen");
    if (imagenInput && imagenInput.files.length > 0) {
        formData.append("imagen", imagenInput.files[0]);
    }

    fetch("/api/donaciones", { method: "POST", body: formData })
        .then(res => res.json())
        .then(data => {
            alert(data.mensaje);
            location.reload();
        });
}

function publicarServicio() {
    const formData = new FormData();
    formData.append("titulo", document.getElementById("titulo").value);
    formData.append("descripcion", document.getElementById("descripcion").value);
    formData.append("ubicacion", document.getElementById("ubicacion").value);
    formData.append("categoria", document.getElementById("categoria").value);
    formData.append("contacto", document.getElementById("contacto").value);

    const imagenInput = document.getElementById("imagen");
    if (imagenInput && imagenInput.files.length > 0) {
        formData.append("imagen", imagenInput.files[0]);
    }

    fetch("/api/servicios", { method: "POST", body: formData })
        .then(res => res.json())
        .then(data => {
            alert(data.mensaje);
            location.reload();
        });
}

function solicitarAyuda() {
    const formData = new FormData();
    formData.append("titulo", document.getElementById("titulo").value);
    formData.append("descripcion", document.getElementById("descripcion").value);
    formData.append("ubicacion", document.getElementById("ubicacion").value);
    formData.append("categoria", document.getElementById("categoria").value);
    formData.append("contacto", document.getElementById("contacto").value);
    const urgenteInput = document.getElementById("urgente");
    formData.append("urgente", urgenteInput && urgenteInput.checked ? "true" : "false");

    const imagenInput = document.getElementById("imagen");
    if (imagenInput && imagenInput.files.length > 0) {
        formData.append("imagen", imagenInput.files[0]);
    }

    fetch("/api/ayuda", { method: "POST", body: formData })
        .then(res => res.json())
        .then(data => {
            alert(data.mensaje);
            location.reload();
        });
}

// EDICION Y ELIMINACION DE DONACIONES

// MODAL DE EDICION (donaciones, servicios, ayuda)
function abrirModalEdicion(html, claseExtra = "") {
    const modal = document.getElementById("modal-edicion");
    const contenido = document.getElementById("modal-edicion-contenido");
    const caja = document.getElementById("modal-edicion-box");
    if (!modal || !contenido) return;

    if (caja) {
        caja.classList.remove("modal-edicion-box-claro");
        if (claseExtra) caja.classList.add(claseExtra);
    }

    contenido.innerHTML = html;
    modal.classList.add("activo");
}

function cerrarModalEdicion() {
    const modal = document.getElementById("modal-edicion");
    const contenido = document.getElementById("modal-edicion-contenido");
    const caja = document.getElementById("modal-edicion-box");
    if (!modal) return;

    modal.classList.remove("activo");
    if (contenido) contenido.innerHTML = "";
    if (caja) caja.classList.remove("modal-edicion-box-claro");
    accionDesdePerfil = false;

    categoriaSeleccionada = null;
    claveSeleccionada = null;
    otroUsuarioIdActual = null;
    if (typeof renderizarListaUsuarios === "function") {
        ["donacion", "servicio", "ayuda"].forEach(cat => {
            if (typeof mensajesPorCategoria !== "undefined") renderizarListaUsuarios(cat);
        });
    }
}

// CONTACTAR: chat flotante
let chatFlotanteActual = null;

function contactarCorreoDesdeDetalle(boton) {
    const d = boton.dataset;
    abrirModalCorreo(parseInt(d.usuarioId, 10), d.usuarioNombre, d.titulo || null);
}

// Modal para mandar un correo real (sin depender de una app de mail instalada)
let correoModalActual = null;

function abrirModalCorreo(destinatarioId, nombreUsuario, publicacionTitulo) {
    correoModalActual = { destinatarioId, publicacionTitulo: publicacionTitulo || null };

    document.getElementById("modal-correo-nombre").textContent = nombreUsuario;
    document.getElementById("modal-correo-asunto").value = "";
    document.getElementById("modal-correo-mensaje").value = "";
    const estado = document.getElementById("modal-correo-estado");
    estado.textContent = "";
    estado.className = "modal-correo-estado";

    document.getElementById("modal-correo").classList.add("activo");
}

function cerrarModalCorreo() {
    document.getElementById("modal-correo").classList.remove("activo");
    correoModalActual = null;
}

function enviarCorreoModal() {
    if (!correoModalActual) return;

    const mensaje = document.getElementById("modal-correo-mensaje").value.trim();
    const asunto = document.getElementById("modal-correo-asunto").value.trim();
    const estado = document.getElementById("modal-correo-estado");
    const boton = document.getElementById("modal-correo-btn-enviar");

    if (!mensaje) {
        estado.textContent = "Escribí un mensaje antes de enviar.";
        estado.className = "modal-correo-estado error";
        return;
    }

    boton.disabled = true;
    estado.textContent = "Enviando...";
    estado.className = "modal-correo-estado";

    fetch("/api/enviar-correo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            destinatario_id: correoModalActual.destinatarioId,
            asunto: asunto,
            mensaje: mensaje,
            publicacion_titulo: correoModalActual.publicacionTitulo
        })
    })
        .then(res => res.json())
        .then(data => {
            boton.disabled = false;
            if (data.exito) {
                estado.textContent = "¡Correo enviado!";
                estado.className = "modal-correo-estado ok";
                setTimeout(cerrarModalCorreo, 1200);
            } else {
                estado.textContent = data.error || "No se pudo enviar el correo.";
                estado.className = "modal-correo-estado error";
            }
        })
        .catch(() => {
            boton.disabled = false;
            estado.textContent = "No se pudo enviar el correo. Revisá tu conexión.";
            estado.className = "modal-correo-estado error";
        });
}

function abrirModalContacto(receptorId, nombreUsuario, tipo, publicacionId, publicacionTitulo, publicacionImagen) {
    abrirChatFlotante(receptorId, nombreUsuario, tipo, publicacionId, publicacionTitulo, publicacionImagen);
}

function abrirChatFlotante(receptorId, nombreUsuario, tipo, publicacionId, publicacionTitulo, publicacionImagen) {
    const widget = document.getElementById("chat-flotante");
    if (!widget) return;

    chatFlotanteActual = { receptorId, nombreUsuario, tipo, publicacionId, publicacionTitulo, publicacionImagen };

    document.getElementById("chat-flotante-nombre").textContent = nombreUsuario;
    document.getElementById("chat-flotante-mensajes").innerHTML =
        `<p class="chat-flotante-vacio">Cargando conversación...</p>`;

    widget.classList.add("activo");
    cargarMensajesChatFlotante();

    const input = document.getElementById("chat-flotante-input");
    if (input) input.focus();
}

function cerrarChatFlotante() {
    const widget = document.getElementById("chat-flotante");
    if (widget) widget.classList.remove("activo");
    chatFlotanteActual = null;
}

async function cargarMensajesChatFlotante() {
    if (!chatFlotanteActual) return;
    const { tipo, nombreUsuario } = chatFlotanteActual;
    const lista = document.getElementById("chat-flotante-mensajes");
    if (!lista) return;

    try {
        const res = await fetch("/api/mensajes");
        const mensajes = await res.json();
        if (!chatFlotanteActual) return; // se cerró mientras cargaba

        const conversacion = mensajes.filter(m => m.tipo === tipo && m.usuario === nombreUsuario);

        if (conversacion.length === 0) {
            lista.innerHTML = `<p class="chat-flotante-vacio">Todavía no hablaste con ${nombreUsuario}. Escribile para consultar por esta publicación.</p>`;
            return;
        }

        // Trae la publicación (imagen + título) de cada mensaje
        const idsUnicos = [...new Set(
            conversacion.filter(m => m.publicacion_id).map(m => m.publicacion_id)
        )];

        const publicacionesPorId = {};
        if (idsUnicos.length > 0) {
            const resultados = await Promise.all(
                idsUnicos.map(id =>
                    fetch(`/api/publicacion/${tipo}/${id}`)
                        .then(r => r.json())
                        .catch(() => null)
                )
            );
            idsUnicos.forEach((id, i) => { publicacionesPorId[id] = resultados[i]; });
        }

        if (!chatFlotanteActual) return; // se cerró mientras cargaba

        lista.innerHTML = conversacion.map(m => {
            const pub = m.publicacion_id ? publicacionesPorId[m.publicacion_id] : null;

            const previewHtml = pub ? `
                <div class="chat-publicacion-preview">
                    ${pub.imagen
                        ? `<img src="/static/uploads/${pub.imagen}">`
                        : imagenPorDefecto(tipo)
                            ? `<img src="${imagenPorDefecto(tipo)}">`
                            : `<div class="chat-publicacion-preview-sinimg"></div>`}
                    <span>${pub.titulo}</span>
                </div>
            ` : `<span class="mensaje-item-publicacion">${m.publicacion_titulo}</span>`;

            return `
                <div class="mensaje-item${m.es_mia ? " mensaje-propia" : ""}">
                    ${previewHtml}
                    <p>${m.mensaje}</p>
                    ${m.fecha ? `<small>${formatearFechaArgentina(m.fecha)}</small>` : ""}
                </div>
            `;
        }).join("");

        lista.scrollTop = lista.scrollHeight;

        conversacion.forEach(m => {
            if (!m.leido && !m.es_mia) marcarComoLeido(m.id);
        });
    } catch (e) {
        lista.innerHTML = `<p class="chat-flotante-vacio">No se pudo cargar la conversación.</p>`;
    }
}

function enviarMensajeChatFlotante() {
    if (!chatFlotanteActual) return;
    const input = document.getElementById("chat-flotante-input");
    if (!input || !input.value.trim()) return;

    const { receptorId, tipo, publicacionId, publicacionTitulo } = chatFlotanteActual;

    const formData = new FormData();
    formData.append("receptor_id", receptorId);
    formData.append("tipo", tipo);
    formData.append("publicacion_id", publicacionId);
    formData.append("publicacion_titulo", publicacionTitulo);
    formData.append("asunto", `Consulta: ${publicacionTitulo}`);
    formData.append("mensaje", input.value.trim());

    input.value = "";

    fetch("/mensaje/enviar", { method: "POST", body: formData })
        .then(() => cargarMensajesChatFlotante())
        .catch(() => alert("No se pudo enviar el mensaje. Probá de nuevo."));
}

// Enter envía el mensaje
document.addEventListener("DOMContentLoaded", () => {
    const inputChatFlotante = document.getElementById("chat-flotante-input");
    if (inputChatFlotante) {
        inputChatFlotante.addEventListener("keydown", event => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                enviarMensajeChatFlotante();
            }
        });
    }
});

// Cierra el modal de ediciOn con Escape 
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        cerrarImagenCompleta();
        cerrarModalEdicion();
        cerrarChatFlotante();
    }
});

function mostrarFormularioEdicion(id, titulo, descripcion, ubicacion, categoria) {
    abrirModalEdicion(`
        <h3>Editar Donación</h3>
        <form id="form-editar">
            <input type="text" id="edit-titulo" value="${titulo}" required>
            <textarea id="edit-descripcion" required>${descripcion}</textarea>
            <select id="edit-ubicacion" required>
                <option value="Norte" ${ubicacion === "Norte" ? "selected" : ""}>Norte</option>
                <option value="Noroeste" ${ubicacion === "Noroeste" ? "selected" : ""}>Noroeste</option>
                <option value="Centro" ${ubicacion === "Centro" ? "selected" : ""}>Centro</option>
                <option value="Oeste" ${ubicacion === "Oeste" ? "selected" : ""}>Oeste</option>
                <option value="Sudoeste" ${ubicacion === "Sudoeste" ? "selected" : ""}>Sudoeste</option>
                <option value="Sur" ${ubicacion === "Sur" ? "selected" : ""}>Sur</option>
            </select>
            <select id="edit-categoria" required>
                ${opcionesCategorias(CATEGORIAS_DONACION, categoria)}
            </select>
            <input type="file" id="edit-imagen">
            <button type="button" onclick="guardarEdicion(${id})">Guardar cambios</button>
            <button type="button" onclick="cerrarModalEdicion()">Cancelar</button>
        </form>
    `);
}

function guardarEdicion(id) {
    const formData = new FormData();
    formData.append("titulo", document.getElementById("edit-titulo").value);
    formData.append("descripcion", document.getElementById("edit-descripcion").value);
    formData.append("ubicacion", document.getElementById("edit-ubicacion").value);
    formData.append("categoria", document.getElementById("edit-categoria").value);
    const imagenInput = document.getElementById("edit-imagen");
    if (imagenInput && imagenInput.files.length > 0) formData.append("imagen", imagenInput.files[0]);

    fetch(`/donaciones/editar/${id}`, { method: "POST", body: formData })
        .then(res => res.json())
        .then(data => {
            alert(data.mensaje);
            if (accionDesdePerfil) {
                accionDesdePerfil = false;
                cerrarModalEdicion();
                cargarMisPublicaciones();
            } else {
                location.reload();
            }
        });
}

function eliminarDonacion(id) {
    if (!confirm("¿Estás seguro que querés eliminar esta donación?")) { accionDesdePerfil = false; return; }
    fetch(`/donaciones/eliminar/${id}`, { method: "POST" })
        .then(res => res.json())
        .then(data => {
            alert(data.mensaje);
            if (accionDesdePerfil) {
                accionDesdePerfil = false;
                cargarMisPublicaciones();
            } else {
                location.reload();
            }
        });
}

// EDICIoN Y ELIMINACIoN DE SERVICIOS
function mostrarFormularioEdicionServicio(id, titulo, descripcion, ubicacion, contacto, categoria) {
    abrirModalEdicion(`
        <h3>Editar Servicio</h3>
        <form id="form-editar-servicio">
            <input type="text" id="edit-titulo" value="${titulo}" required>
            <textarea id="edit-descripcion" required>${descripcion}</textarea>
            <select id="edit-ubicacion" required>
                <option value="Norte" ${ubicacion === "Norte" ? "selected" : ""}>Norte</option>
                <option value="Noroeste" ${ubicacion === "Noroeste" ? "selected" : ""}>Noroeste</option>
                <option value="Centro" ${ubicacion === "Centro" ? "selected" : ""}>Centro</option>
                <option value="Oeste" ${ubicacion === "Oeste" ? "selected" : ""}>Oeste</option>
                <option value="Sudoeste" ${ubicacion === "Sudoeste" ? "selected" : ""}>Sudoeste</option>
                <option value="Sur" ${ubicacion === "Sur" ? "selected" : ""}>Sur</option>
            </select>
            <select id="edit-categoria" required>
                ${opcionesCategorias(CATEGORIAS_SERVICIO, categoria)}
            </select>
            <input type="text" id="edit-contacto" value="${contacto}" readonly style="background-color:#eee; cursor:not-allowed;">
            <input type="file" id="edit-imagen">
            <button type="button" onclick="guardarEdicionServicio(${id})">Guardar cambios</button>
            <button type="button" onclick="cerrarModalEdicion()">Cancelar</button>
        </form>
    `);
}

function guardarEdicionServicio(id) {
    const formData = new FormData();
    formData.append("titulo", document.getElementById("edit-titulo").value);
    formData.append("descripcion", document.getElementById("edit-descripcion").value);
    formData.append("ubicacion", document.getElementById("edit-ubicacion").value);
    formData.append("categoria", document.getElementById("edit-categoria").value);
    formData.append("contacto", document.getElementById("edit-contacto").value);
    const imagenInput = document.getElementById("edit-imagen");
    if (imagenInput && imagenInput.files.length > 0) formData.append("imagen", imagenInput.files[0]);

    fetch(`/servicios/editar/${id}`, { method: "POST", body: formData })
        .then(res => res.json())
        .then(data => {
            alert(data.mensaje);
            if (accionDesdePerfil) {
                accionDesdePerfil = false;
                cerrarModalEdicion();
                cargarMisPublicaciones();
            } else {
                location.reload();
            }
        });
}

function eliminarServicio(id) {
    if (!confirm("¿Estás seguro que querés eliminar este servicio?")) { accionDesdePerfil = false; return; }
    fetch(`/servicios/eliminar/${id}`, { method: "POST" })
        .then(res => res.json())
        .then(data => {
            alert(data.mensaje);
            if (accionDesdePerfil) {
                accionDesdePerfil = false;
                cargarMisPublicaciones();
            } else {
                location.reload();
            }
        });
}

// EDICION Y ELIMINACION DE AYUDA
function mostrarFormularioEdicionAyuda(id, titulo, descripcion, ubicacion, contacto, categoria, urgente = false) {
    abrirModalEdicion(`
        <h3>Editar Solicitud de Ayuda</h3>
        <form id="form-editar-ayuda">
            <input type="text" id="edit-titulo" value="${titulo}" required>
            <textarea id="edit-descripcion" required>${descripcion}</textarea>
            <select id="edit-ubicacion" required>
                <option value="Norte" ${ubicacion === "Norte" ? "selected" : ""}>Norte</option>
                <option value="Noroeste" ${ubicacion === "Noroeste" ? "selected" : ""}>Noroeste</option>
                <option value="Centro" ${ubicacion === "Centro" ? "selected" : ""}>Centro</option>
                <option value="Oeste" ${ubicacion === "Oeste" ? "selected" : ""}>Oeste</option>
                <option value="Sudoeste" ${ubicacion === "Sudoeste" ? "selected" : ""}>Sudoeste</option>
                <option value="Sur" ${ubicacion === "Sur" ? "selected" : ""}>Sur</option>
            </select>
            <select id="edit-categoria" required>
                ${opcionesCategorias(CATEGORIAS_AYUDA, categoria)}
            </select>
            <input type="text" id="edit-contacto" value="${contacto}" readonly style="background-color:#eee; cursor:not-allowed;">
            <div class="campo-checkbox">
                <input type="checkbox" id="edit-urgente" ${urgente ? "checked" : ""}>
                <label for="edit-urgente">Marcar como urgente</label>
            </div>
            <input type="file" id="edit-imagen">
            <button type="button" onclick="guardarEdicionAyuda(${id})">Guardar cambios</button>
            <button type="button" onclick="cerrarModalEdicion()">Cancelar</button>
        </form>
    `);
}

function guardarEdicionAyuda(id) {
    const formData = new FormData();
    formData.append("titulo", document.getElementById("edit-titulo").value);
    formData.append("descripcion", document.getElementById("edit-descripcion").value);
    formData.append("ubicacion", document.getElementById("edit-ubicacion").value);
    formData.append("categoria", document.getElementById("edit-categoria").value);
    formData.append("contacto", document.getElementById("edit-contacto").value);
    const editUrgenteInput = document.getElementById("edit-urgente");
    formData.append("urgente", editUrgenteInput && editUrgenteInput.checked ? "true" : "false");
    const imagenInput = document.getElementById("edit-imagen");
    if (imagenInput && imagenInput.files.length > 0) formData.append("imagen", imagenInput.files[0]);

    fetch(`/ayuda/editar/${id}`, { method: "POST", body: formData })
        .then(res => res.json())
        .then(data => {
            alert(data.mensaje);
            if (accionDesdePerfil) {
                accionDesdePerfil = false;
                cerrarModalEdicion();
                cargarMisPublicaciones();
            } else {
                location.reload();
            }
        });
}

function eliminarAyuda(id) {
    if (!confirm("¿Estás seguro que querés eliminar esta solicitud de ayuda?")) { accionDesdePerfil = false; return; }
    fetch(`/ayuda/eliminar/${id}`, { method: "POST" })
        .then(res => res.json())
        .then(data => {
            alert(data.mensaje);
            if (accionDesdePerfil) {
                accionDesdePerfil = false;
                cargarMisPublicaciones();
            } else {
                location.reload();
            }
        });
}

// PUBLICACIONES GLOBALES Y MENSAJES 
function cargarPublicacionesGlobales(termino = "", distrito = "", orden = "recientes") {
    fetch("/api/publicaciones")
        .then(res => res.json())
        .then(publicaciones => {
            const contenedor = document.getElementById("lista-publicaciones");
            if (!contenedor) return;

            // "Últimas publicaciones" (dashboard) ver publicaciones de otros usuarios, no las propias
            publicaciones = publicaciones.filter(p => !p.es_mia);

            if (distrito) {
                publicaciones = publicaciones.filter(p => p.ubicacion === distrito);
            }

            const buscado = normalizarTexto(termino.trim());
            if (buscado) {
                publicaciones = publicaciones.filter(p => {
                    const texto = normalizarTexto(
                        `${p.titulo} ${p.descripcion} ${p.ubicacion || ""} ${p.categoria || ""} ${p.usuario || ""}`
                    );
                    return texto.includes(buscado);
                });
            }

            // Ordena por fecha de creación (recientes o antiguas)
            publicaciones = publicaciones.slice().sort((a, b) => {
                const fechaA = new Date(a.fecha_creacion).getTime() || 0;
                const fechaB = new Date(b.fecha_creacion).getTime() || 0;
                return orden === "antiguas" ? fechaA - fechaB : fechaB - fechaA;
            });

            contenedor.innerHTML = "";
            if (publicaciones.length === 0) {
                contenedor.innerHTML = `<p class="sin-resultados">No se encontraron publicaciones.</p>`;
                return;
            }
            publicaciones.forEach(p => {
                const div = document.createElement("div");
                div.className = "publicacion-global" + (p.tipo === "ayuda" && p.urgente ? " tarjeta-urgente" : "");
                div.dataset.id = p.id;
                div.dataset.tipo = p.tipo;
                div.innerHTML = `
                    ${p.imagen
                        ? `<img src="/static/uploads/${p.imagen}" alt="Publicación">`
                        : imagenPorDefecto(p.tipo)
                            ? `<img src="${imagenPorDefecto(p.tipo)}" alt="Publicación">`
                            : `<div class="imagen-placeholder">Sin imagen</div>`}
                    <div class="tarjeta-info">
                        <div class="titulo-ayuda-row">
                            <h3 class="tarjeta-titulo">${p.titulo}</h3>
                            ${p.tipo === "ayuda" && p.urgente ? `<span class="badge-urgente">⚠ Urgente</span>` : ""}
                        </div>
                        <small class="tarjeta-publicado-por"><strong>Publicado por:</strong> ${p.usuario || ""}</small>
                        <div class="tarjeta-boton">
                            <button type="button" class="btn-ver-publicacion"
                                onclick="event.stopPropagation(); irADetallePublicacion('${p.tipo}', ${p.id})">
                                Ver
                            </button>
                        </div>
                    </div>
                `;
                div.addEventListener("click", event => {
                    if (event.target.closest("button")) return;
                    irADetallePublicacion(p.tipo, p.id);
                });
                contenedor.appendChild(div);
            });
        })
        .catch(() => {
            const cont = document.getElementById("lista-publicaciones");
            if (cont) cont.innerHTML = "<p>Error al cargar los datos.</p>";
        });
}

function cargarCantidadMensajes() {
    fetch("/api/mensajes")
        .then(r => r.json())
        .then(datos => {
            const span = document.getElementById("cantidad-mensajes");
            if (span && Array.isArray(datos)) {
                const noLeidos = datos.filter(m => !m.leido && !m.es_mia).length;
                span.innerText = noLeidos;
                span.style.display = noLeidos > 0 ? "flex" : "none";
            }
        })
        .catch(() => {});
}

// BANDEJA DE MENSAJES 

let mensajesPorCategoria = { donacion: {}, servicio: {}, ayuda: {} };
let categoriaSeleccionada = null;
let claveSeleccionada = null; // usuario + publicación puntual

// Convierte la fecha a horario 
function formatearFechaArgentina(fecha) {
    if (!fecha) return "";
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return fecha; // si no se puede parsear, muestra el texto tal cual

    return d.toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function cargarMensajes() {
    const contenedorDonacion = document.getElementById("lista-usuarios-donacion");
    if (!contenedorDonacion) return; // Solo corre en la página /mensajes

    fetch("/api/mensajes")
        .then(res => res.json())
        .then(mensajes => {
            // Agrupa los mensajes por usuario, una sola conversación por persona
            mensajesPorCategoria = { donacion: {}, servicio: {}, ayuda: {} };

            mensajes.forEach(m => {
                const categoria = ["donacion", "servicio", "ayuda"].includes(m.tipo) ? m.tipo : "donacion";

                if (!mensajesPorCategoria[categoria][m.usuario]) {
                    mensajesPorCategoria[categoria][m.usuario] = {
                        usuario: m.usuario,
                        otroId: m.es_mia ? m.receptor_id : m.emisor_id,
                        mensajes: []
                    };
                }
                mensajesPorCategoria[categoria][m.usuario].mensajes.push(m);
            });

            renderizarListaUsuarios("donacion");
            renderizarListaUsuarios("servicio");
            renderizarListaUsuarios("ayuda");

            // Si ya había una conversacion abierta, la refresca
            if (categoriaSeleccionada && claveSeleccionada &&
                mensajesPorCategoria[categoriaSeleccionada][claveSeleccionada]) {
                mostrarConversacion(categoriaSeleccionada, claveSeleccionada);
            }
        })
        .catch(() => {
            contenedorDonacion.innerHTML = "<p>Error al cargar los mensajes.</p>";
        });
}

function renderizarListaUsuarios(categoria) {
    const contenedor = document.getElementById(`lista-usuarios-${categoria}`);
    if (!contenedor) return;

    const claves = Object.keys(mensajesPorCategoria[categoria]);

    if (claves.length === 0) {
        contenedor.innerHTML = `<p class="sin-mensajes-categoria">Sin mensajes.</p>`;
        return;
    }

    contenedor.innerHTML = "";
    claves.forEach(clave => {
        const grupo = mensajesPorCategoria[categoria][clave];
        const noLeidos = grupo.mensajes.filter(m => !m.leido && !m.es_mia).length;

        const item = document.createElement("div");
        item.className = "usuario-mensaje-item" +
            (categoria === categoriaSeleccionada && clave === claveSeleccionada ? " activo" : "");
        item.innerHTML = `
            <span>${grupo.usuario}</span>
            <div class="usuario-mensaje-acciones">
                ${noLeidos > 0 ? `<span class="badge-no-leidos">${noLeidos}</span>` : ""}
                <button type="button" class="btn-eliminar-chat" title="Eliminar chat" onclick="event.stopPropagation(); eliminarChat('${categoria}', ${grupo.otroId})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M10 11v6M14 11v6" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
        `;
        item.onclick = () => mostrarConversacion(categoria, clave);
        contenedor.appendChild(item);
    });
}

function eliminarChat(categoria, otroId) {
    if (!confirm("¿Eliminar esta conversación? Esta acción no se puede deshacer.")) return;

    const formData = new FormData();
    formData.append("tipo", categoria);
    formData.append("otro_id", otroId);

    fetch("/mensaje/eliminar_conversacion", { method: "POST", body: formData })
        .then(res => res.json())
        .then(() => {
            if (categoriaSeleccionada === categoria) {
                cerrarConversacionAbierta();
            }
            cargarMensajes();
        })
        .catch(() => alert("No se pudo eliminar la conversación."));
}

let otroUsuarioIdActual = null;
let publicacionIdActual = null;
let publicacionTituloActual = null;

async function mostrarConversacion(categoria, clave) {
    categoriaSeleccionada = categoria;
    claveSeleccionada = clave;

    // Vuelve a pintar las tres columnas para marcar la activa
    renderizarListaUsuarios("donacion");
    renderizarListaUsuarios("servicio");
    renderizarListaUsuarios("ayuda");

    const grupo = mensajesPorCategoria[categoria] && mensajesPorCategoria[categoria][clave];
    const mensajesUsuario = grupo ? grupo.mensajes : [];
    const usuario = grupo ? grupo.usuario : "";

    // Saca el id del otro usuario a partir del ultimo mensaje
    otroUsuarioIdActual = null;
    if (mensajesUsuario.length > 0) {
        const ultimo = mensajesUsuario[mensajesUsuario.length - 1];
        otroUsuarioIdActual = ultimo.es_mia ? ultimo.receptor_id : ultimo.emisor_id;
    }

    // Busca la publicación más reciente 
    publicacionIdActual = null;
    publicacionTituloActual = null;
    for (let i = mensajesUsuario.length - 1; i >= 0; i--) {
        const m = mensajesUsuario[i];
        if (m.publicacion_titulo && m.publicacion_titulo !== "Consulta general") {
            publicacionIdActual = m.publicacion_id;
            publicacionTituloActual = m.publicacion_titulo;
            break;
        }
    }

    // Trae la imagen de cada publicacion 
    const idsUnicos = [...new Set(
        mensajesUsuario.filter(m => m.publicacion_id).map(m => m.publicacion_id)
    )];

    const publicacionesPorId = {};
    if (idsUnicos.length > 0) {
        const resultados = await Promise.all(
            idsUnicos.map(id =>
                fetch(`/api/publicacion/${categoria}/${id}`)
                    .then(res => res.json())
                    .catch(() => null)
            )
        );
        idsUnicos.forEach((id, i) => { publicacionesPorId[id] = resultados[i]; });
    }

    let html = `
        <div class="chat-abierto-header">
            <h3>${usuario}</h3>
            <span class="chat-abierto-cerrar" onclick="cerrarConversacionAbierta()" title="Cerrar">&times;</span>
        </div>
        <div id="chat-mensajes-lista" class="chat-mensajes-lista">
    `;

    mensajesUsuario.forEach(m => {
        const pub = m.publicacion_id ? publicacionesPorId[m.publicacion_id] : null;

        html += `
            <div class="mensaje-item${m.es_mia ? " mensaje-propia" : ""}${!m.es_mia && !m.leido ? " mensaje-no-leido" : ""}" data-id="${m.id}">
                ${pub ? `
                    <div class="chat-publicacion-preview">
                        ${pub.imagen
                            ? `<img src="/static/uploads/${pub.imagen}">`
                            : imagenPorDefecto(categoria)
                                ? `<img src="${imagenPorDefecto(categoria)}">`
                                : `<div class="chat-publicacion-preview-sinimg"></div>`}
                        <span>${pub.titulo}</span>
                    </div>
                ` : ""}
                <p>${m.mensaje}</p>
                ${m.fecha ? `<small>${formatearFechaArgentina(m.fecha)}</small>` : ""}
            </div>
        `;

        // Marca como leído solo lo que vos recibiste, no lo que vos mandaste
        if (!m.leido && !m.es_mia) {
            m.leido = true;
            marcarComoLeido(m.id);
        }
    });

    html += `
        </div>
        <div class="form-chat-mensaje">
            <input type="text" id="input-chat-mensaje" placeholder="Escribí un mensaje..." autocomplete="off"
                onkeydown="if(event.key === 'Enter'){ event.preventDefault(); enviarMensajeChat(); }">
            <button type="button" onclick="enviarMensajeChat()" class="btn-contacto">Enviar</button>
        </div>
    `;

    document.getElementById("chat-abierto-contenido").innerHTML = html;
    mostrarPanelChatAbierto(categoria);

    // Baja el scroll al ultimo mensaje
    const lista = document.getElementById("chat-mensajes-lista");
    if (lista) lista.scrollTop = lista.scrollHeight;

    const input = document.getElementById("input-chat-mensaje");
    if (input) input.focus();
}

// Muestra el panel de chat ocupando el lugar de las otras dos categorías
function mostrarPanelChatAbierto(categoriaActiva) {
    ["donacion", "servicio", "ayuda"].forEach(cat => {
        const panel = document.getElementById(`categoria-${cat}`);
        if (!panel) return;
        panel.classList.toggle("oculta", cat !== categoriaActiva);
    });

    const panelChat = document.getElementById("panel-chat-abierto");
    if (panelChat) panelChat.classList.add("activo");
}

// Cierra el chat abierto y vuelve a mostrar las tres categorías completas.
function cerrarConversacionAbierta() {
    categoriaSeleccionada = null;
    claveSeleccionada = null;

    ["donacion", "servicio", "ayuda"].forEach(cat => {
        const panel = document.getElementById(`categoria-${cat}`);
        if (panel) panel.classList.remove("oculta");
    });

    const panelChat = document.getElementById("panel-chat-abierto");
    if (panelChat) panelChat.classList.remove("activo");

    const contenido = document.getElementById("chat-abierto-contenido");
    if (contenido) contenido.innerHTML = "";

    renderizarListaUsuarios("donacion");
    renderizarListaUsuarios("servicio");
    renderizarListaUsuarios("ayuda");
}

function enviarMensajeChat() {
    const input = document.getElementById("input-chat-mensaje");
    if (!input || !input.value.trim() || !otroUsuarioIdActual) return;

    const formData = new FormData();
    formData.append("receptor_id", otroUsuarioIdActual);
    formData.append("asunto", publicacionTituloActual ? `Consulta: ${publicacionTituloActual}` : "Mensaje");
    formData.append("mensaje", input.value.trim());
    formData.append("tipo", categoriaSeleccionada || "");
    // Hereda la publicacion de la que se venía hablando 
    if (publicacionIdActual) formData.append("publicacion_id", publicacionIdActual);
    if (publicacionTituloActual) formData.append("publicacion_titulo", publicacionTituloActual);

    input.value = "";

    fetch("/mensaje/enviar", { method: "POST", body: formData })
        .then(() => cargarMensajes()) // recarga y vuelve a pintar la conversación abierta, con el mensaje nuevo
        .catch(() => {
            alert("No se pudo enviar el mensaje. Probá de nuevo.");
        });
}

function marcarComoLeido(id) {
    fetch(`/api/mensajes/leer/${id}`, { method: "POST" })
        .then(() => cargarCantidadMensajes())
        .catch(() => {});
}

// VER IMAGEN COMPLETA
function verImagenCompleta(src) {
    const modal = document.getElementById("modal-imagen");
    const img = document.getElementById("modal-imagen-img");
    if (!modal || !img) return;

    img.src = src;
    modal.style.display = "flex";
}

function cerrarImagenCompleta() {
    const modal = document.getElementById("modal-imagen");
    const img = document.getElementById("modal-imagen-img");
    if (!modal) return;

    modal.style.display = "none";
    if (img) img.src = "";
}

// MI PERFIL: pestañas

function mostrarTabPerfil(tab, boton) {
    document.querySelectorAll(".perfil-panel").forEach(p => p.style.display = "none");
    document.querySelectorAll(".perfil-tab").forEach(b => b.classList.remove("activo"));

    const panel = document.getElementById(`tab-${tab}`);
    if (panel) panel.style.display = "flex";
    if (boton) boton.classList.add("activo");

    if (tab === "historial") cargarHistorial();
    if (tab === "publicaciones") cargarMisPublicaciones();
}

// MI PERFIL: información personal

function guardarInfoPersonal() {
    const form = document.getElementById("form-info-personal");
    const formData = new FormData(form);

    fetch("/perfil/actualizar", { method: "POST", body: formData })
        .then(res => res.json())
        .then(data => {
            alert(data.mensaje || data.error || "Listo");
            if (data.foto_perfil) actualizarAvatarUI(data.foto_perfil);
        })
        .catch(() => alert("No se pudieron guardar los cambios."));
}

// Reemplaza el avatar por la imagen indicada
function actualizarAvatarUI(urlFoto) {
    document.querySelectorAll("#perfil-avatar-circulo, #avatar-header").forEach(contenedor => {
        contenedor.innerHTML = `<img src="${urlFoto}" alt="Avatar">`;
    });
}

// Vista previa instantánea al elegir una foto, antes de guardar
const inputFotoPerfil = document.getElementById("input-foto-perfil");
if (inputFotoPerfil) {
    inputFotoPerfil.addEventListener("change", function () {
        const archivo = this.files[0];
        if (!archivo) return;

        const lector = new FileReader();
        lector.onload = e => actualizarAvatarUI(e.target.result);
        lector.readAsDataURL(archivo);
    });
}

// MI PERFIL: contraseña y seguridad

function guardarContrasena() {
    const form = document.getElementById("form-cambiar-contrasena");
    const formData = new FormData(form);

    fetch("/perfil/cambiar_contrasena", { method: "POST", body: formData })
        .then(res => res.json())
        .then(data => {
            alert(data.mensaje || data.error || "Listo");
            if (data.mensaje) form.reset();
        })
        .catch(() => alert("No se pudo cambiar la contraseña."));
}

function darDeBajaCuenta() {
    if (!confirm("¿Estás absolutamente seguro de que deseas dar de baja tu cuenta? Esta acción eliminará permanentemente tus publicaciones y datos del sistema.")) {
        return;
    }

    fetch("/perfil/baja", { method: "POST" })
        .then(res => res.json())
        .then(data => {
            alert(data.mensaje || data.error || "Listo");
            if (data.mensaje) window.location.href = "/";
        })
        .catch(() => alert("Ocurrió un error al intentar dar de baja la cuenta."));
}

// MI PERFIL: historial

function cargarHistorial() {
    const contenedor = document.getElementById("lista-historial");
    if (!contenedor) return;

    fetch("/api/historial")
        .then(res => res.json())
        .then(eventos => {
            if (!Array.isArray(eventos) || eventos.length === 0) {
                contenedor.innerHTML = "<p>No tenés historial todavía.</p>";
                return;
            }

            contenedor.innerHTML = eventos.map(ev => `
                <div class="historial-item">
                    <strong>${ev.titulo}</strong>
                    <span>${etiquetaEventoTexto(ev.evento)} · ${etiquetaCategoriaTexto(ev.categoria)}</span>
                    <small>${formatearFechaArgentina(ev.fecha)}</small>
                </div>
            `).join("");
        })
        .catch(() => {
            contenedor.innerHTML = "<p>Error al cargar el historial.</p>";
        });
}

function etiquetaEventoTexto(evento) {
    if (evento === "publicada") return "se publicó";
    if (evento === "editada") return "se editó";
    if (evento === "concretada") return "se marcó como concretada";
    if (evento === "no_concretada") return "se marcó como no concretada";
    if (evento === "eliminada") return "se eliminó";
    return evento;
}

function etiquetaCategoriaTexto(categoria) {
    if (categoria === "donacion") return "Donación";
    if (categoria === "servicio") return "Servicio";
    if (categoria === "ayuda") return "Ayuda";
    return "";
}

// MI PERFIL: mis publicaciones

let misPublicacionesDatos = { donaciones: [], servicios: [], ayuda: [] };
let filtroPublicacionesActivo = "todas";

function cargarMisPublicaciones() {
    fetch("/api/mis_publicaciones")
        .then(res => res.json())
        .then(datos => {
            misPublicacionesDatos = datos;
            renderizarListasFiltradas();
        })
        .catch(() => {});
}

function filtrarMisPublicaciones(filtro, boton) {
    filtroPublicacionesActivo = filtro;
    document.querySelectorAll(".filtro-btn").forEach(b => b.classList.remove("activo"));
    if (boton) boton.classList.add("activo");
    renderizarListasFiltradas();
}

function renderizarListasFiltradas() {
    const aplicarFiltro = items => {
        if (filtroPublicacionesActivo === "activas") return items.filter(i => !i.concretada);
        if (filtroPublicacionesActivo === "concretadas") return items.filter(i => i.concretada);
        return items;
    };

    renderizarMisPublicaciones("mis-donaciones", aplicarFiltro(misPublicacionesDatos.donaciones), "donacion");
    renderizarMisPublicaciones("mis-servicios", aplicarFiltro(misPublicacionesDatos.servicios), "servicio");
    renderizarMisPublicaciones("mis-ayuda", aplicarFiltro(misPublicacionesDatos.ayuda), "ayuda");
}

function renderizarMisPublicaciones(contenedorId, items, categoria) {
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    if (!items || items.length === 0) {
        const mensaje = filtroPublicacionesActivo === "concretadas"
            ? "No tenés publicaciones concretadas en esta categoría."
            : filtroPublicacionesActivo === "activas"
                ? "No tenés publicaciones activas en esta categoría."
                : "Todavía no tenés publicaciones acá.";
        contenedor.innerHTML = `<p>${mensaje}</p>`;
        return;
    }

    contenedor.innerHTML = items.map(item => `
        <div class="mi-publicacion-item${item.concretada ? " concretada" : ""}">
            <div class="mi-publicacion-info">
                ${item.imagen
                    ? `<img src="/static/uploads/${item.imagen}" class="mi-publicacion-img">`
                    : imagenPorDefecto(categoria)
                        ? `<img src="${imagenPorDefecto(categoria)}" class="mi-publicacion-img">`
                        : `<div class="mi-publicacion-img-vacia"></div>`}
                <strong class="mi-publicacion-titulo" onclick="verDetallePublicacion('${categoria}', ${item.id})">${item.titulo}</strong>
                ${item.concretada ? `<span class="badge-concretada">Concretada</span>` : ""}
            </div>
            <div class="tarjeta-boton">
                <button onclick="marcarConcretada('${categoria}', ${item.id}, ${!item.concretada})" class="btn-contacto">
                    ${item.concretada ? "Marcar como no concretada" : "Marcar como concretada"}
                </button>
                <button onclick="editarDesdePerfil('${categoria}', ${item.id})" class="btn-editar">Editar</button>
                <button onclick="eliminarDesdePerfil('${categoria}', ${item.id})" class="btn-eliminar">Eliminar</button>
            </div>
        </div>
    `).join("");
}

function marcarConcretada(categoria, id, valor) {
    const ruta = categoria === "donacion" ? "donaciones" : categoria === "servicio" ? "servicios" : "ayuda";

    const formData = new FormData();
    formData.append("concretada", valor);

    fetch(`/${ruta}/concretar/${id}`, { method: "POST", body: formData })
        .then(() => cargarMisPublicaciones())
        .catch(() => alert("No se pudo actualizar."));
}

// EDICION Y ELIMINACION DESDE PERFIL 
let accionDesdePerfil = false;

// Abre el detalle de una publicación como modal, por encima de todo el contenido
// (usado desde "Mis publicaciones" en el perfil)
function verDetallePublicacion(categoria, id) {
    mostrarDetalleModal(categoria, id);
}

function mostrarDetalleModal(tipo, id) {
    fetch("/api/publicaciones")
        .then(res => res.json())
        .then(publicaciones => {
            const p = publicaciones.find(item =>
                item.tipo === tipo && Number(item.id) === Number(id)
            );

            if (!p) {
                window.location.href = `/publicacion/${tipo}/${id}`;
                return;
            }

            const overlay = document.createElement("div");
            overlay.className = "modal-detalle-publicacion-overlay";
            overlay.innerHTML = `<div class="modal-detalle-publicacion-box">${construirDetalleEmbebido(p)}</div>`;
            document.body.appendChild(overlay);

            const caja = overlay.querySelector(".modal-detalle-publicacion-box");
            activarVerMasDescripcion(caja, p.titulo, p.descripcion);

            // En este modal (Mis publicaciones) no se muestra "Más publicaciones de..."
            const masPublicaciones = overlay.querySelector(".detalle-embebido-mas-publicaciones");
            if (masPublicaciones) masPublicaciones.remove();

            function cerrarModal() {
                overlay.remove();
                document.removeEventListener("keydown", escListener);
            }
            function escListener(event) {
                if (event.key === "Escape") cerrarModal();
            }

            overlay.addEventListener("click", event => {
                if (event.target === overlay) cerrarModal();
            });
            document.addEventListener("keydown", escListener);

            const botonCerrar = overlay.querySelector(".detalle-embebido-cerrar");
            if (botonCerrar) botonCerrar.addEventListener("click", cerrarModal);

            const botonContactar = overlay.querySelector(".detalle-embebido-contactar");
            if (botonContactar) {
                botonContactar.addEventListener("click", event => {
                    event.stopPropagation();
                    abrirModalContacto(
                        p.user_id,
                        p.usuario,
                        p.tipo,
                        p.id,
                        p.titulo,
                        p.imagen || null
                    );
                });
            }
        })
        .catch(() => {
            window.location.href = `/publicacion/${tipo}/${id}`;
        });
}

// ACCIONES DESDE LA PANTALLA DE DETALLE
function contactarDesdeDetalle(boton) {
    const d = boton.closest(".detalle-pagina-info").dataset;
    abrirModalContacto(parseInt(d.userId, 10), d.usuario, d.tipo, parseInt(d.id, 10), d.titulo, d.imagen || null);
}

// Chat en la pantalla de detalle 
function inicializarChatDetalle() {
    const panel = document.getElementById("detalle-chat-panel");
    if (!panel) return;
    cargarChatDetalle();
}

function cargarChatDetalle() {
    const panel = document.getElementById("detalle-chat-panel");
    if (!panel) return;
    const d = panel.dataset;
    const lista = document.getElementById("detalle-chat-mensajes");

    fetch("/api/mensajes")
        .then(res => res.json())
        .then(async mensajes => {
            const conversacion = mensajes.filter(m => m.tipo === d.tipo && m.usuario === d.otroUsuario);

            if (conversacion.length === 0) {
                lista.innerHTML = `<p class="mas-publicaciones-vacio">Todavía no hablaste con ${d.otroUsuario}. Escribile para consultar por esta publicación.</p>`;
                return;
            }

            // Cada mensaje puede ser sobre una publicación distinta 
            const idsUnicos = [...new Set(
                conversacion.filter(m => m.publicacion_id).map(m => m.publicacion_id)
            )];

            const publicacionesPorId = {};
            if (idsUnicos.length > 0) {
                const resultados = await Promise.all(
                    idsUnicos.map(id =>
                        fetch(`/api/publicacion/${d.tipo}/${id}`)
                            .then(res => res.json())
                            .catch(() => null)
                    )
                );
                idsUnicos.forEach((id, i) => { publicacionesPorId[id] = resultados[i]; });
            }

            lista.innerHTML = conversacion.map(m => {
                const pub = m.publicacion_id ? publicacionesPorId[m.publicacion_id] : null;
                const previewPub = pub && m.publicacion_titulo && m.publicacion_titulo !== "Consulta general" ? `
                    <div class="chat-publicacion-preview">
                        ${pub.imagen
                            ? `<img src="/static/uploads/${pub.imagen}">`
                            : imagenPorDefecto(d.tipo)
                                ? `<img src="${imagenPorDefecto(d.tipo)}">`
                                : `<div class="chat-publicacion-preview-sinimg"></div>`}
                        <span>${pub.titulo}</span>
                    </div>
                ` : "";

                return `
                    <div class="mensaje-item${m.es_mia ? " mensaje-propia" : ""}">
                        ${previewPub}
                        <p>${m.mensaje}</p>
                        ${m.fecha ? `<small>${formatearFechaArgentina(m.fecha)}</small>` : ""}
                    </div>
                `;
            }).join("");

            lista.scrollTop = lista.scrollHeight;

            conversacion.forEach(m => {
                if (!m.leido && !m.es_mia) marcarComoLeido(m.id);
            });
        })
        .catch(() => {
            lista.innerHTML = `<p class="mas-publicaciones-vacio">No se pudo cargar la conversación.</p>`;
        });
}

function enviarMensajeDetalle() {
    const panel = document.getElementById("detalle-chat-panel");
    const input = document.getElementById("detalle-chat-input");
    if (!panel || !input || !input.value.trim()) return;

    const d = panel.dataset;
    const formData = new FormData();
    formData.append("receptor_id", d.otroId);
    formData.append("tipo", d.tipo);
    formData.append("publicacion_id", d.publicacionId);
    formData.append("publicacion_titulo", d.publicacionTitulo);
    formData.append("asunto", `Consulta: ${d.publicacionTitulo}`);
    formData.append("mensaje", input.value.trim());

    input.value = "";

    fetch("/mensaje/enviar", { method: "POST", body: formData })
        .then(() => cargarChatDetalle())
        .catch(() => alert("No se pudo enviar el mensaje. Probá de nuevo."));
}

// Marca una publicación como concretada/no concretada desde la pantalla de detalle
// y recarga la página para reflejar el cambio 
function marcarConcretadaDesdeDetalle(boton) {
    const d = boton.closest(".detalle-pagina-info").dataset;
    const valor = d.concretada === "true" ? "false" : "true";
    const ruta = d.tipo === "donacion" ? "donaciones" : d.tipo === "servicio" ? "servicios" : "ayuda";

    const formData = new FormData();
    formData.append("concretada", valor);

    fetch(`/${ruta}/concretar/${d.id}`, { method: "POST", body: formData })
        .then(() => location.reload())
        .catch(() => alert("No se pudo actualizar."));
}

function editarDesdeDetalle(boton) {
    const d = boton.closest(".detalle-pagina-info").dataset;
    const id = parseInt(d.id, 10);

    if (d.tipo === "donacion") {
        mostrarFormularioEdicion(id, d.titulo, d.descripcion, d.ubicacion, d.categoria);
    } else if (d.tipo === "servicio") {
        mostrarFormularioEdicionServicio(id, d.titulo, d.descripcion, d.ubicacion, d.contacto, d.categoria);
    } else {
        mostrarFormularioEdicionAyuda(id, d.titulo, d.descripcion, d.ubicacion, d.contacto, d.categoria, d.urgente === "true");
    }
}

function eliminarDesdeDetalle(boton) {
    const d = boton.closest(".detalle-pagina-info").dataset;
    const id = parseInt(d.id, 10);

    if (d.tipo === "donacion") {
        eliminarDonacion(id);
    } else if (d.tipo === "servicio") {
        eliminarServicio(id);
    } else {
        eliminarAyuda(id);
    }
}

// Ícono de chat de la pantalla de detalle
function contactarDesdeDetalle(boton) {
    const d = boton.closest(".detalle-pagina-card").querySelector(".detalle-pagina-info").dataset;
    const id = parseInt(d.id, 10);
    abrirModalContacto(parseInt(d.userId, 10), d.usuario, d.tipo, id, d.titulo, d.imagen || null);
}

function editarDesdePerfil(categoria, id) {
    accionDesdePerfil = true;

    const lista = categoria === "donacion" ? misPublicacionesDatos.donaciones
                : categoria === "servicio" ? misPublicacionesDatos.servicios
                : misPublicacionesDatos.ayuda;

    const item = lista.find(i => i.id === id);
    if (!item) { accionDesdePerfil = false; return; }

    if (categoria === "donacion") {
        mostrarFormularioEdicion(item.id, item.titulo, item.descripcion, item.ubicacion, item.categoria);
    } else if (categoria === "servicio") {
        mostrarFormularioEdicionServicio(item.id, item.titulo, item.descripcion, item.ubicacion, item.contacto, item.categoria);
    } else {
        mostrarFormularioEdicionAyuda(item.id, item.titulo, item.descripcion, item.ubicacion, item.contacto, item.categoria, item.urgente);
    }
}

function eliminarDesdePerfil(categoria, id) {
    accionDesdePerfil = true;

    if (categoria === "donacion") {
        eliminarDonacion(id);
    } else if (categoria === "servicio") {
        eliminarServicio(id);
    } else {
        eliminarAyuda(id);
    }
}