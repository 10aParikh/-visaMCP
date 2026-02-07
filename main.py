"""
Visa MCP Server for Dedalus Labs Marketplace
Provides tools for Visa APIs: FX Rates, ATM Locator, Subscription Manager, Stop Payment Service
"""

import os
import httpx
from dedalus_mcp import MCPServer, tool
from dotenv import load_dotenv

load_dotenv()

# Configuration
VISA_USER_ID = os.getenv("VISA_USER_ID", "")
VISA_PASSWORD = os.getenv("VISA_PASSWORD", "")
VISA_CERT_PATH = os.getenv("VISA_CERT_PATH", "./certs/cert.pem")
VISA_KEY_PATH = os.getenv("VISA_KEY_PATH", "./certs/key.pem")
VISA_ENV = os.getenv("VISA_ENV", "sandbox")

BASE_URL = (
    "https://sandbox.api.visa.com" if VISA_ENV == "sandbox" 
    else "https://api.visa.com"
)


def get_visa_client() -> httpx.Client:
    """Create an authenticated Visa API client with mTLS."""
    return httpx.Client(
        base_url=BASE_URL,
        auth=(VISA_USER_ID, VISA_PASSWORD),
        cert=(VISA_CERT_PATH, VISA_KEY_PATH),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        timeout=30.0,
    )


# ====================
# Core Tools
# ====================

@tool(description="Test connectivity to Visa API. Returns a hello world response to verify authentication is working.")
def hello_world() -> str:
    """Test Visa API connectivity."""
    try:
        with get_visa_client() as client:
            response = client.get("/vdp/helloworld")
            response.raise_for_status()
            return str(response.json())
    except Exception as e:
        return f"Error: {str(e)}"


@tool(description="Get foreign exchange rate between two currencies. Provide source and destination currency codes (e.g., USD, EUR, GBP) and the amount to convert.")
def get_exchange_rate(
    source_currency: str,
    destination_currency: str,
    amount: float
) -> str:
    """Get exchange rate between currencies."""
    try:
        with get_visa_client() as client:
            response = client.post(
                "/forexrates/v2/foreignexchangerates",
                json={
                    "sourceCurrencyCode": source_currency,
                    "destinationCurrencyCode": destination_currency,
                    "sourceAmount": str(amount),
                }
            )
            response.raise_for_status()
            return str(response.json())
    except Exception as e:
        return f"Error: {str(e)}"


@tool(description="Find nearby Visa ATMs. Provide latitude, longitude, and optional distance (default 5) and unit (km or mi).")
def find_nearby_atms(
    latitude: float,
    longitude: float,
    distance: int = 5,
    distance_unit: str = "km"
) -> str:
    """Find nearby Visa ATMs."""
    try:
        with get_visa_client() as client:
            response = client.post(
                "/globalatmlocator/v1/localatms/atmLocator",
                json={
                    "wsRequestHeaderV2": {
                        "requestTs": "2024-01-01T00:00:00Z",
                        "applicationId": "VISA_MCP",
                    },
                    "requestData": {
                        "location": {
                            "geocodes": {
                                "latitude": latitude,
                                "longitude": longitude,
                            },
                        },
                        "options": {
                            "range": {
                                "distance": distance,
                                "distanceUnit": distance_unit,
                            },
                            "findFilters": [],
                            "sort": {
                                "primary": "distance",
                                "direction": "asc",
                            },
                        },
                    },
                }
            )
            response.raise_for_status()
            return str(response.json())
    except Exception as e:
        return f"Error: {str(e)}"


# ====================
# Visa Subscription Manager (VSM) Tools
# ====================

@tool(description="Search for active subscription stop instructions for a card. Provide the card PAN (Primary Account Number).")
def vsm_search(pan: str) -> str:
    """Search for subscription stop instructions."""
    try:
        with get_visa_client() as client:
            response = client.post("/vsm/v1/search", json={"pan": pan})
            response.raise_for_status()
            return str(response.json())
    except Exception as e:
        return f"Error: {str(e)}"


@tool(description="Get merchant details for a subscription transaction. Provide the transaction ID.")
def vsm_merchant_details(transaction_id: str) -> str:
    """Get merchant details for a transaction."""
    try:
        with get_visa_client() as client:
            response = client.post("/vsm/v1/merchantdetails", json={"transactionId": transaction_id})
            response.raise_for_status()
            return str(response.json())
    except Exception as e:
        return f"Error: {str(e)}"


@tool(description="Add a merchant to stop subscription payments. Provide card PAN, merchant ID, and optional reason.")
def vsm_add_merchant(pan: str, merchant_id: str, reason: str = "Subscription cancellation") -> str:
    """Add a merchant to stop list."""
    try:
        with get_visa_client() as client:
            response = client.post(
                "/vsm/v1/addmerchant",
                json={"pan": pan, "merchantId": merchant_id, "reason": reason}
            )
            response.raise_for_status()
            return str(response.json())
    except Exception as e:
        return f"Error: {str(e)}"


@tool(description="Cancel an existing subscription stop instruction. Provide the stop instruction ID.")
def vsm_cancel(stop_id: str) -> str:
    """Cancel a stop instruction."""
    try:
        with get_visa_client() as client:
            response = client.post("/vsm/v1/cancel", json={"stopId": stop_id})
            response.raise_for_status()
            return str(response.json())
    except Exception as e:
        return f"Error: {str(e)}"


# ====================
# Visa Stop Payment Service (VSPS) Tools
# ====================

@tool(description="Search for active stop payment instructions for a card. Provide the card PAN.")
def vsps_search_instructions(pan: str) -> str:
    """Search for stop payment instructions."""
    try:
        with get_visa_client() as client:
            response = client.post("/vsps/v1/stopinstructions/search", json={"pan": pan})
            response.raise_for_status()
            return str(response.json())
    except Exception as e:
        return f"Error: {str(e)}"


@tool(description="Search for transactions eligible for stop payment. Provide card PAN and optional days to look back (30-180, default 90).")
def vsps_search_eligible(pan: str, days: int = 90) -> str:
    """Search for eligible transactions."""
    try:
        with get_visa_client() as client:
            response = client.post(
                "/vsps/v1/eligibletransactions/search",
                json={"pan": pan, "searchPeriodDays": days}
            )
            response.raise_for_status()
            return str(response.json())
    except Exception as e:
        return f"Error: {str(e)}"


@tool(description="Add a stop payment instruction. Provide card PAN, level (merchant/mcc/pan), and merchant_id or mcc based on level.")
def vsps_add_stop(
    pan: str,
    level: str,
    merchant_id: str = None,
    mcc: str = None
) -> str:
    """Add a stop payment instruction."""
    try:
        payload = {"pan": pan, "level": level}
        if level == "merchant" and merchant_id:
            payload["merchantId"] = merchant_id
        elif level == "mcc" and mcc:
            payload["mcc"] = mcc
        
        with get_visa_client() as client:
            response = client.post("/vsps/v1/stopinstructions/add", json=payload)
            response.raise_for_status()
            return str(response.json())
    except Exception as e:
        return f"Error: {str(e)}"


@tool(description="Cancel an existing stop payment instruction. Provide the stop instruction ID.")
def vsps_cancel_stop(stop_id: str) -> str:
    """Cancel a stop payment instruction."""
    try:
        with get_visa_client() as client:
            response = client.post("/vsps/v1/stopinstructions/cancel", json={"stopId": stop_id})
            response.raise_for_status()
            return str(response.json())
    except Exception as e:
        return f"Error: {str(e)}"


@tool(description="Update an existing stop payment instruction. Provide stop ID and updates as key-value pairs.")
def vsps_update_stop(stop_id: str, updates: dict) -> str:
    """Update a stop payment instruction."""
    try:
        with get_visa_client() as client:
            response = client.post(
                "/vsps/v1/stopinstructions/update",
                json={"stopId": stop_id, **updates}
            )
            response.raise_for_status()
            return str(response.json())
    except Exception as e:
        return f"Error: {str(e)}"


@tool(description="Extend the end date of a stop payment instruction. Provide stop ID and new end date (YYYY-MM-DD).")
def vsps_extend_stop(stop_id: str, new_end_date: str) -> str:
    """Extend a stop payment instruction."""
    try:
        with get_visa_client() as client:
            response = client.post(
                "/vsps/v1/stopinstructions/extend",
                json={"stopId": stop_id, "newEndDate": new_end_date}
            )
            response.raise_for_status()
            return str(response.json())
    except Exception as e:
        return f"Error: {str(e)}"


# Create the MCP server
server = MCPServer("visa-mcp")

# Register all tools
server.collect(
    # Core tools
    hello_world,
    get_exchange_rate,
    find_nearby_atms,
    # VSM tools
    vsm_search,
    vsm_merchant_details,
    vsm_add_merchant,
    vsm_cancel,
    # VSPS tools
    vsps_search_instructions,
    vsps_search_eligible,
    vsps_add_stop,
    vsps_cancel_stop,
    vsps_update_stop,
    vsps_extend_stop,
)

if __name__ == "__main__":
    import asyncio
    asyncio.run(server.serve())
