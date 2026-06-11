"use strict";

// @ts-ignore
const stripe = require("stripe")(process.env.STRIPE_KEY);

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
    async create(ctx) {
        // @ts-ignore
        const { products } = ctx.request.body;
        try {
            console.log(products);
            const lineItems = await Promise.all(
                products.map(async (product) => {
                    // Strapi v5 usa documentId en lugar de id numérico
                    const item = await strapi
                        .service("api::product.product")
                        .findOne(product.documentId);

                    return {
                        price_data: {
                            currency: "mxn",
                            product_data: {
                                name: item.ProductName,
                            },
                            unit_amount: Math.round(item.Price * 100),
                        },
                        quantity: 1,
                    };
                })
            );

            const session = await stripe.checkout.sessions.create({
                shipping_address_collection: { allowed_countries: ["ES", "MX"] },
                payment_method_types: ["card"],
                mode: "payment",
                success_url: process.env.CLIENT_URL + "/success",
                cancel_url: process.env.CLIENT_URL + "/successError",
                line_items: lineItems,
            });

            await strapi
                .service("api::order.order")
                .create({ data: { products, stripeId: session.id } });

            return { stripeSession: session };
        } catch (error) {
            console.log("ERROR STRIPE:", error);
            ctx.response.status = 500;
            return { error };
        }
    },
}));