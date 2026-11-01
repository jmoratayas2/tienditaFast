-- ==============================================================================
-- DATOS SEMILLA (PRODUCTOS DE EJEMPLO)
-- ==============================================================================

INSERT INTO public.products (name, description, price, stock, category, image_url)
VALUES 
    (
        'Café Espresso Especial 250g',
        'Café de grano tostado artesanal de altura, notas achocolatadas.',
        4500.00,
        25,
        'Cafetería',
        'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80'
    ),
    (
        'Croissant de Mantequilla Francés',
        'Horneado el día de hoy, hojaldre crujiente con mantequilla premium.',
        1500.00,
        18,
        'Panadería',
        'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&auto=format&fit=crop&q=80'
    ),
    (
        'Empanada Artesanal de Pollo y Champiñones',
        'Relleno jugoso y masa dorada al horno.',
        1800.00,
        12,
        'Panadería',
        'https://images.unsplash.com/photo-1628102491629-778571d893a3?w=500&auto=format&fit=crop&q=80'
    ),
    (
        'Jugo Natural de Naranja y Fruta de la Pasión 500ml',
        'Sin azúcar añadida, 100% natural y recién prensado.',
        2200.00,
        30,
        'Bebidas',
        'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=80'
    ),
    (
        'Sandwich Gourmet Jamón Serrano y Queso Gouda',
        'En pan ciabatta con rúcula fresca y aderezo dijon.',
        3900.00,
        10,
        'Comidas',
        'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&auto=format&fit=crop&q=80'
    ),
    (
        'Batido Energético Frutos Rojos 400ml',
        'Fresa, mora, arándano con leche de almendras y semillas de chía.',
        2800.00,
        15,
        'Bebidas',
        'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500&auto=format&fit=crop&q=80'
    ),
    (
        'Muffin de Chocolate Belga',
        'Bizcocho suave relleno de chispas de chocolate semi-amargo.',
        1400.00,
        20,
        'Repostería',
        'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=500&auto=format&fit=crop&q=80'
    ),
    (
        'Agua Mineral con Gas 500ml',
        'Agua purificada de manantial con gasificación suave.',
        1000.00,
        40,
        'Bebidas',
        'https://images.unsplash.com/photo-1559839914-ba2ac5cd0c8e?w=500&auto=format&fit=crop&q=80'
    ),
    (
        'Bowl de Yogur Griego y Granola Artesanal',
        'Acompañado de miel pura de abeja y frutas de temporada.',
        3200.00,
        8,
        'Comidas',
        'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&auto=format&fit=crop&q=80'
    ),
    (
        'Galleta Rellena Choco-Avellana',
        'Galleta estilo New York horneada con centro cremoso.',
        1200.00,
        22,
        'Repostería',
        'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=500&auto=format&fit=crop&q=80'
    )
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- USUARIOS DE PERSONAL INICIALES (CONTROL INTERNO)
-- ==============================================================================
INSERT INTO public.staff_users (email, full_name, role, is_active)
VALUES
    ('admin@tiendita.com', 'Administrador Principal', 'admin', true),
    ('despacho@tiendita.com', 'Carlos Mora (Despachador)', 'despachador', true),
    ('ana@tiendita.com', 'Ana Gómez (Cajera)', 'despachador', true)
ON CONFLICT (email) DO UPDATE
SET full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
