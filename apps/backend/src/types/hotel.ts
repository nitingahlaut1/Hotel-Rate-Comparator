export type SupplierBehavior =
  | "success"
  | "delay"
  | "slow"
  | "empty"
  | "error"
  | "fail-twice";

export interface HotelSearchRequest {
  city: string;
  checkIn: string;
  checkOut: string;
  workflowId?: string;
  behavior?: SupplierBehavior;
  supplierABehavior?: SupplierBehavior;
  supplierBBehavior?: SupplierBehavior;
}

export interface Hotel {
  hotelId: string;
  name: string;
  price: number;
  supplier: "A" | "B";
}

export interface SupplierResponse {
  hotels: Hotel[];
}

export interface SearchResult {
  hotelId: string;
  name: string;
  price: number;
  supplier: "A" | "B";
}

export interface SupplierExecutionResult {
  success: boolean;
  hotels?: Hotel[];
  error?: string;
}

export type WorkflowExecutionStatus = "SUCCESS" | "NO_HOTELS_FOUND" | "PARTIAL_SUCCESS";

export interface HotelSearchWorkflowResult {
  cheapestHotel: Hotel | null;
  status: WorkflowExecutionStatus;
  supplierResults: {
    supplierA: SupplierExecutionResult;
    supplierB: SupplierExecutionResult;
  };
  searchRequest: HotelSearchRequest;
}

export interface SearchApiResponse {
  workflowId: string;
  hotelId: string;
  name: string;
  price: number;
  supplier: "A" | "B";
  status: WorkflowExecutionStatus;
}
