// ============================================================================
// RESPONSE HANDLER (STANDARD FORMAT RITASI APP)
// ============================================================================

export const success = (res, message = "Success", data = null) => {
    return res.json({
      status: true,
      message,
      data,
    });
  };
  
  export const error = (res, code = 500, message = "Error", err = null) => {
    return res.status(code).json({
      status: false,
      message,
      error: err ? err.message : null,
    });
  };
  