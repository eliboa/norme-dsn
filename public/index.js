import DataSources from './data-sources.js';
const DataSource = new DataSources();
// Variables globales pour stocker les données et l'état de l'application
let currentData = null, tree = null, treeview = null;

/*******************************************
 * FONCTIONS STATIQUES DE L'APPLICATION
 ******************************************/
/**
 * Trouve un noeud dans un arbre de noeuds via sa clef
 * ⚠️ Cette fonction est récusivive
 * @param {string} key 
 * @param {[Object]} nodes 
 * @returns {Object | null}
 */
function findInNodes(key, nodes) {
    for (const node of nodes) {
        if (node.key === key)
            return node;

        if (!node.nodes?.length)
            continue;

        const result = findInNodes(key, node.nodes);
        if (result)
            return result;
    }
    return null;
}
/**
 * Recherche un noeud dans un arbre de noeuds via son texte
 * ⚠️ Cette fonction est récusivive
 * @param {string} value 
 * @param {[Object]} nodes 
 * @returns {Object | null}
 */
function searchInNodes(value, nodes) {
    for (const node of nodes) {
        if (node.text.includes(value))
            return node;

        if (!node.nodes?.length)
            continue;

        const result = searchInNodes(value, node.nodes);
        if (result)
            return result;
    }
    return null;
}
/**
 * Convertir les Blocks DSN en arbre de noeuds
 * @param {Object} data Un objet contenant les collections `Blocks`, `Fields`, `Messages`, etc.
 * @returns un objet de nodes décrits par `key`, `text`, `data` et `nodes` (enfants, le cas échéant)
 */
function treeFromData(data) 
{
    const queue = [...data.Blocks];
    const tree = [{
        text: '<b>S10.G00.00 - Envoi</b>',
        key: 'S10.G00.00',
        data: {
            "Id": "S10.G00.00",
            "Name": "Envoi",
            "Description": "En-tête",
            fields: data.Fields.filter(f => f['Block Id'] === 'S10.G00.00')
        }
    }]

    while(queue.length > 0) 
    {
        const block = queue.shift();

        if (!block.ParentId?.length)
            continue;

        const parentId = data.Blocks.some(b => b.Id === block.ParentId) ? block.ParentId : 'S10.G00.00'
        const parent = findInNodes(parentId, tree);
        if (parent) {
            if (!parent.nodes?.length)
                parent.nodes = [];

            block.fields = data.Fields.filter(f => f['Block Id'] === block.Id);
            parent.nodes.push({                
                text: `<b>${block.Id}</b> - ${block.Name}`,
                key: block.Id,
                data: block
            })
        }
        else queue.push(block);
    }
    return tree;
}
/**
 * Sélectionne dynamiquement un noeud dans l'arbre de la sidebar
 * @param {string} key la clef du noeud `node.key`
 */
function selectNodeByKey(key, silent=false){
    var treeViewObject = $('#sidebar-tree').data('treeview'),
    allCollapsedNodes = treeViewObject.getCollapsed(),
    allExpandedNodes = treeViewObject.getExpanded(),
    allNodes = allCollapsedNodes.concat(allExpandedNodes);
    for (var i = 0; i < allNodes.length; i++) {
        if (allNodes[i].key != key) continue;
        treeViewObject.selectNode(allNodes[i].nodeId, { silent });

        var parent = treeViewObject.getParent(allNodes[i]);
        while(parent){          	
            treeViewObject.expandNode(parent, { silent });
            parent = treeViewObject.getParent(parent);
        }
        break;   
    }
}
/**
 * Générer la carte d'un field à partir de ses données
 * @param {Object} field 
 * @returns {HTMLElement} un objet HTML (jQuery) représentant la carte du field  
 */
function $fieldCard(field) {
    const key = field['Block Id']+'.'+field.Id; 
    const $card = $($('#field-template').html());
    $card.attr('id', key.replaceAll('.', '-'));
    $('#id', $card).html(key);
    $('#name', $card).html(field.Name);
    $('#description', $card).html(field.Description ? $descriptionToHtmlElement(field.Description) : '');
    
    // Format
    let r = field.DataType.Nature, min = parseInt(field.DataType['Lg Min']), max = parseInt(field.DataType['Lg Max']);
    if (r == 'Enumeration' && field.DataType.Values?.length) {
        r = '<ul>'+ field.DataType.Values.split(';').map(v => `<li>${v.replace('=', ' : ')}</li>`).join('') +'</ul>'
        $('#format-title', $card).html('Valeurs possibles');
    }
    else if (min && (min === max || !max)) 
        r += ' ('+min+')';
    else if (min && max)                        
        r += ` (${min} -> ${max})`;

    if (field.DataType.Regexp?.length) {
        r += `<br/><code>${field.DataType.Regexp}</code>`;
        $('#format-title', $card).append(' + Expression régulière');
    }

    $('#format', $card).html(r);

    // Contrôles
    const $controles = $('#controles', $card);
    if (!field.Controls?.length)
        $controles.hide();
    else {

        // On accumule les structures HTML pures sous forme de chaînes de caractères
        const controlesHtmlArray = field.Controls.map(c => `
            <div class="row mb-2">
                <div class="col justify-content-center font-monospace" style="max-width: 5rem !important;">${c.Name}</div>
                <div class="col">
                    <span class="description">${c.Description ? $descriptionToHtmlElement(c.Description).html() : ''}</span>
                    <br/>
                    <span class="message">${c.Message ? $descriptionToHtmlElement(c.Message).html() : ''}</span>
                </div>
            </div>
        `);

        // 2. Un SEUL append dans le DOM avec toutes les cartes jointes
        $controles.append(controlesHtmlArray.join(''));

        // 3. On attache les écouteurs de clics de manière globale sur le parent pour éviter de dupliquer les "on('click')"
        $controles.on('click', '.route-link', function(e) {
            e.preventDefault();
            routeTo($(this).data('route'));
        });
    }

    const usages = currentData.Usages?.[field['Block Id']+'.'+field.Id];
    const $usages = $('#usages', $card);
    if (!usages?.length) {
        $usages.hide();
    } else {
        // On accumule les structures HTML pures sous forme de chaînes de caractères
        const usagesHtmlArray = usages.map(u => `
            <div class="row">
                <div class="col-9">${u.description}</div>
                <div class="col-1">${usageLabel(u.value)}</div>
            </div>
        `);
        $usages.append(usagesHtmlArray?.join(''));
    }

    return $card;
}

function usageLabel(u) {
    if (u === 'O') return '<span class="text-danger">Obligatoire ❗</span>';
    if (u === 'N') return '<span class="text-secondary">Non requis</span>';
    if (u === 'F') return '<span class="text-success">Facultatif</span>';
    if (u === 'C') return '<span class="text-warning">Conditionnel</span>';
    if (u === 'I') return '<span class="text-secondary">Interdit</span>';
    return u;
}

/**
 * Générer la vue -- quand un noeud est sélectionné
 * @param {Object} node 
 */
function generateViewFromNode(node, scrollToFieldKey = null) 
{    
    const $view = $('#view');
    const $body = $($('#block-view-template').html());
    const block = node.data;
    $view.html($body);

    // Fonction lamba pour styliser cardianlité
    const formatBound = bound => {
        if (bound == '0') return '0️⃣';
        if (bound == '1') return '1️⃣';
        if (bound == '*') return '♾️';
        return bound;
    }

    $('.titre', $view).html(node.text);
    $('.description', $view).html(block.Description?.length ? $descriptionToHtmlElement(block.Description) : '');    
    if (!block.Description?.length) {
        $('.description-title', $view).hide();
    }
    $('.lower-bound', $view).html(formatBound(block.lowerBound));
    $('.upper-bound', $view).html(formatBound(block.upperBound));

    // 
    const $usages = $('.usages', $view);
    const usagesHtmlArray = block.Usages?.map(u => `
        <div class="row">
            <div class="col-9">${u.description}</div>
            <div class="col-1">${usageLabel(u.value)}</div>
        </div>
    `);
    $usages.append(usagesHtmlArray?.join(''));
    if (!block.Usages?.length) {
        $('.usages-container', $view).hide();
    }

    // 📋 Générer la liste des rubriques et le sommaire
    const $fields = $('.fields', $view);
    const $fieldsSummary = $('.fields-summary', $view);
    const summaryHtmlArray = [];
    for (const field of block.fields) {
        summaryHtmlArray.push(`
            <div class="row row-cols-auto">
                <div class="col">${$descriptionToHtmlElement(field['Block Id']+'.'+field.Id).html()}</div>
                <div class="col">${field.Name}</div>
            </div>
        `);
        $fields.append($fieldCard(field));        
    }
    $fieldsSummary.append(summaryHtmlArray.join(''));
    $fieldsSummary.on('click', '.route-link', function(e) {
        e.preventDefault();
        routeTo($(this).data('route'));
    });

    // Gérer le scroll vers la rubrique ciblée (si spécifiée)
    const $scrollTo = scrollToFieldKey ? $('#'+scrollToFieldKey.replaceAll('.', '-'), $fields) : $body;
    if ($scrollTo.length) {
        $view.scrollTop($scrollTo.offset().top - $view.offset().top + $view.scrollTop());
        if (scrollToFieldKey) {
            let element = $scrollTo.find('.card-header');
            element.addClass('highlight');
            setTimeout(() => {
                element.removeClass('highlight');
            }, 800);
        }
    }    
}

/**
 * Transformer une description DSN en un objet HTML (jQuery) avec les retours à la ligne et les liens cliquables
 * @param {string} description 
 * @returns {HTMLElement} un objet HTML (jQuery) représentant la description avec les retours à la ligne et les liens cliquables
 */
function $descriptionToHtmlElement(description) {
    if(!description?.length) return '';
    
    // Transformer les retours à la ligne en <br/>
    let html = description.replaceAll('\r\n', '<br/>');
    
    // Transformer les références de champs (ex: S21.G00.30.01) en liens cliquables
    // Capturer les patterns type SXX.GXX.XX ou SXX.GXX.XX.XXX
    const dsnPattern = /(S\d{2}\.G\d{2}\.\d{2}(?:\.\d{3})?)/g;
    html = html.replace(dsnPattern, function(match) {
        return `<a href="#" class="route-link" data-route="${match}">${match}</a>`;
    });

    let $html = $('<span></span>').html(html);
    $html.on('click', '.route-link', function(e) {
        e.preventDefault();
        routeTo($(this).data('route'));
    });
    return $html;
}

/**
 * Navigue vers une route spécifique et génère la vue correspondante
 * @param {string} route 
 * @param {boolean} pushToBrowser 
 */
function routeTo(route, pushToBrowser = true) {
    const routeType = route?.split('.').length - 1 === 3 ? 'field' : 'block';
    let fieldKey = routeType == 'field' ? route : null;
    let blockId = routeType == 'block' ? route : route?.split('.').slice(0, 3).join('.');
    const selectedNode = findInNodes(blockId, tree);
    if (selectedNode) {
        // Désactive le trigger automatique de 'nodeSelected' pour éviter les boucles
        selectNodeByKey(selectedNode.key, true); 
        generateViewFromNode(selectedNode, fieldKey);

        // 💡 Synchro Navigateur : On pousse la route dans l'historique du navigateur
        if (pushToBrowser) history.pushState({ route: route }, null, "");
    }
}

/**
 * Appelle une fonction asynchrone tout en affichant un spinner de chargement et en masquant les autres éléments de l'interface
 * @param {function} asyncFunction 
 * @param {...*} args - Arguments à passer à la fonction asynchrone
 */
function callWithLoadingSpinner(asyncFunction, ...args) {
    const $spinner = $('.spinner');
    const $viewContainer = $('#view-container');
    const $sidebar = $('#sidebar');
    $spinner.show();
    $viewContainer.hide();
    $sidebar.hide();
    asyncFunction(...args).then(() => {
        $spinner.hide();
        $viewContainer.show();
        $sidebar.show();
    });
}
/**
 * Intialiser l'application (pour une source de données sélectionnée)
 */
async function initApp() 
{
    // 1️⃣ Récupérer les données de l'application
    const data = await DataSource.selected.fetch();
    currentData = data;

    // 2️⃣ Convertir les données lue en arbre de noeuds (tree)
    tree = treeFromData(data);

    // 3️⃣ Générer le contenu de le sidebar avec l'arbre de noeuds 
    const $tree =  $('#sidebar-tree')    
    $tree.treeview({
        data: tree,
        showBorder: false,
        expandIcon: 'bi bi-plus-lg',
        collapseIcon: 'bi bi-dash-lg',
        emptyIcon: 'bi icon-none'
    });
    treeview = $tree.data('treeview');

    // 4️⃣ Gérer l'action sur la sélection d'un noeud dans la sidebar
    $tree.on('nodeSelected', function (event, node) {
        if (!node.state?.expanded)
            treeview.expandNode(treeview.getSelected()?.[0]);

        routeTo(node.data.Id)
    });

    // 5️⃣ Gérer le niveau d'expand initial et le noeud sélectionné par défaut
    treeview.expandAll({ silent: true, levels: 3 }); // ➕ Faire un expand sur l'arbre sur 3 niveaux

    if (routeArg) {
        setTimeout(() => { 
            routeTo(routeArg); 
            routeArg = null;
        }, 100);
    } else {
        const selectedNode = findInNodes('S21.G00.30', tree) ?? tree?.[0];    
        if (selectedNode) {
            selectNodeByKey(selectedNode.key);
            history.replaceState({ route: selectedNode.key }, null, "");
        }
    }
    // 6️⃣ Générer les tooltips Bootstrap à ce stade ça ne fait pas de mal ^^
    $('[data-bs-toggle="tooltip"]').tooltip();

    // 7️⃣ Gérer les actions dans les sticky bars (main & sidebar) et autres...
    /// 💡 Gestion du switch dark/light mode
    const tt = bootstrap.Tooltip.getOrCreateInstance('#switch-theme-mode');
    function switchMode(mode) {
        const $link = $('#switch-theme-mode');
        if (mode == 'dark') {
            tt.setContent({ '.tooltip-inner': 'Activer mode clair' })
            $link.html(`<i class="bi bi-sun-fill"></i>`);
            $('.dropdown', $('.sticky-header')).attr('data-bs-theme', 'light');
            $('html').attr('data-bs-theme', 'dark');
            $link.removeClass('light').addClass('dark');
            localStorage.setItem("darkMode", true);
            tt.hide();
        }
        else {
            tt.setContent({ '.tooltip-inner': 'Activer mode sombre' })
            $link.html(`<i class="bi bi-moon-stars-fill"></i>`);
            $('html').attr('data-bs-theme', 'light');
            $('.dropdown', $('.sticky-header')).attr('data-bs-theme', 'dark');
            $link.removeClass('dark').addClass('light');
            localStorage.setItem("darkMode", false);
            tt.hide();
        }
    }
    if (localStorage.getItem("darkMode") === "true")
        switchMode('dark');
    else if (localStorage.getItem("darkMode") === "false")
        switchMode('light');
    else if ($('html').attr('data-bs-theme'))
        switchMode($('html').attr('data-bs-theme'));

    $('#switch-theme-mode').click(function() {
        switchMode($(this).hasClass('light') ? 'dark' : 'light');
    })

    /// 🔎 Autocomplete de recherche
    const source = data.Blocks.map(b => {
        return {
            key: b.Id,
            label: `${b.Id} - ${b.Name}`
        }
    }).concat(data.Fields.map(f => {
        return {
            key: f['Block Id'],
            label: `${f['Block Id']}.${f.Id} - ${f.Name}`,
            fieldKey: `${f['Block Id']}.${f.Id}`
        }
    }))
    $('#tree-search-input').autocomplete({
        source,
        classes: {
            "ui-menu-item-wrapper": "autocomplete-item"
        },
        select: function(event, ui) {
            selectNodeByKey(ui.item.key);
            if (ui.item.fieldKey) {
                generateViewFromNode(findInNodes(ui.item.key, tree), ui.item.fieldKey);
            }
            event.preventDefault();
            $('#tree-search-input').val('');            
        }
    })

    /// ➕ Bouton expand all
    $('#expand-all-btn').click(() => {
        treeview.expandAll({ silent: true, levels: 99 });
    })

    /// ➖ Bouton collapse all
    $('#collapse-all-btn').click(() => {
        selectNodeByKey(tree[0].key);
        treeview.collapseAll();
        treeview.expandNode(treeview.getSelected()?.[0]);
    })

    /// 🗄️ Gérer les sources de données
    const $sources = $('#data-source');
    $sources.empty();
    DataSource.forEach(s => {
        const $option = $('<option></option>');
        $option.attr('value', s.norme).text(s.norme);
        if (s.selected)
            $option.prop('selected', true);
        $sources.append($option);
    })

    $sources.change(function() {
        const selectedNorme = $(this).val();
        const selectedSource = DataSource.find(s => s.norme === selectedNorme);
        if (selectedSource) {
            DataSource.selected = selectedNorme;
            callWithLoadingSpinner(initApp);
        }
    });

    /// 📏 Permettre le redimensionnement la sidebar
    $("#sidebar").resizable({
        handles: "e", // 'e' pour East : redimensionnement uniquement par le bord droit
        maxWidth: 500,
        minWidth: 200
    });


    // ⬅️ Gérer la navigation avec les boutons "Précédent" et "Suivant" du navigateur
    $(window).on('popstate', function(event) {
        // On récupère l'état (state) qui a été stocké lors du pushState
        const state = event.originalEvent.state;
        
        if (state && state.route) {
            // On navigue vers la route, mais en passant false pour ne pas recréer un historique de navigateur
            routeTo(state.route, false);
        } 
    });

    // Détecte le scroll sur la page
    $('#view').scroll(function() {
        if ($(this).scrollTop() > 300) { // Si on a scrollé de plus de 300px
            $('#backToTop').fadeIn();    // On affiche le bouton en fondu
        } else {
            $('#backToTop').fadeOut();   // Sinon on le cache
        }
    });

    // Action au clic sur le bouton
    $('#backToTop').click(function() {
        $('#view').animate({ scrollTop: 0 }, 600); // Remonte en 600 millisecondes
        return false;
    });
}

/*******************************************
 * INITIALISATION DE L'APPLICATION
 ******************************************/
let routeArg = Object.fromEntries(new URLSearchParams(window.location.search))?.route || null;

$(document).ready(() => {
    callWithLoadingSpinner(initApp);
})