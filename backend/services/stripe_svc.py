import os
import stripe


def create_deposit_session(booking_id: str, client_name: str, amount_cents: int = 2500):
    base_url = os.getenv("BASE_URL", "http://localhost:5173")
    return stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": "Grooming Appointment Deposit",
                        "description": f"Holds {client_name}'s grooming slot",
                    },
                    "unit_amount": amount_cents,
                },
                "quantity": 1,
            }
        ],
        mode="payment",
        success_url=f"{base_url}/booking/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{base_url}/booking/cancel",
        metadata={"booking_id": booking_id},
    )
