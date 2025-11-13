//! Router implementation for Sira Gateway

use crate::{GatewayResult, GatewayError, RouteConfig, RouteMatch, HttpRequest, HttpMethod};
use regex::Regex;
use std::collections::HashMap;

/// Route node for efficient path matching
#[derive(Debug)]
struct RouteNode {
    children: HashMap<String, RouteNode>,
    param_child: Option<Box<RouteNode>>,
    wildcard_child: Option<Box<RouteNode>>,
    route_id: Option<String>,
    is_param: bool,
    param_name: Option<String>,
    is_wildcard: bool,
}

/// HTTP Router
#[derive(Debug)]
pub struct Router {
    routes: HashMap<HttpMethod, RouteNode>,
    route_configs: HashMap<String, RouteConfig>,
}

impl Router {
    /// Create a new router
    pub fn new() -> Self {
        let mut routes = HashMap::new();
        routes.insert(HttpMethod::GET, RouteNode::new());
        routes.insert(HttpMethod::POST, RouteNode::new());
        routes.insert(HttpMethod::PUT, RouteNode::new());
        routes.insert(HttpMethod::DELETE, RouteNode::new());
        routes.insert(HttpMethod::PATCH, RouteNode::new());
        routes.insert(HttpMethod::HEAD, RouteNode::new());
        routes.insert(HttpMethod::OPTIONS, RouteNode::new());

        Self {
            routes,
            route_configs: HashMap::new(),
        }
    }

    /// Add a route
    pub fn add_route(&mut self, config: RouteConfig) -> GatewayResult<()> {
        let route_id = config.id.clone();
        self.route_configs.insert(route_id.clone(), config.clone());

        for method_str in &config.methods {
            let method = self.parse_method(method_str)?;
            self.add_route_for_method(method, &config.path, &route_id)?;
        }

        Ok(())
    }

    /// Add route for specific method
    fn add_route_for_method(&mut self, method: HttpMethod, path: &str, route_id: &str) -> GatewayResult<()> {
        if let Some(root) = self.routes.get_mut(&method) {
            self.insert_route(root, path, route_id)?;
        } else {
            return Err(GatewayError::Routing(format!("Unsupported method: {:?}", method)));
        }
        Ok(())
    }

    /// Match a request to a route
    pub fn match_route(&self, request: &HttpRequest) -> GatewayResult<RouteMatch> {
        let root = self.routes.get(&request.method).ok_or_else(|| {
            GatewayError::Routing(format!("Method not supported: {:?}", request.method))
        })?;

        let (route_id, path_params) = self.find_route(root, &request.path)?;

        let route_config = self.route_configs.get(&route_id).ok_or_else(|| {
            GatewayError::Routing(format!("Route config not found: {}", route_id))
        })?;

        Ok(RouteMatch {
            route_id,
            backend: route_config.backend.clone(),
            path_params,
            matched_path: route_config.path.clone(),
        })
    }

    /// Get all routes
    pub fn get_routes(&self) -> Vec<&RouteConfig> {
        self.route_configs.values().collect()
    }

    /// Remove a route
    pub fn remove_route(&mut self, route_id: &str) -> GatewayResult<()> {
        if let Some(config) = self.route_configs.remove(route_id) {
            for method_str in &config.methods {
                if let Ok(method) = self.parse_method(method_str) {
                    self.remove_route_for_method(method, &config.path);
                }
            }
        }
        Ok(())
    }

    /// Parse HTTP method string
    /// Remove route for specific method
    fn remove_route_for_method(&mut self, method: HttpMethod, path: &str) {
        if let Some(root) = self.routes.get_mut(&method) {
            self.remove_route_from_tree(root, path);
        }
    }

    /// Insert route for specific method
    fn insert_route_for_method(&mut self, method: HttpMethod, path: &str, route_id: &str) -> GatewayResult<()> {
        let root = self.routes.get_mut(&method).ok_or_else(|| {
            GatewayError::Routing(format!("Unsupported method: {:?}", method))
        })?;
        self.insert_route(root, path, route_id)
    }

    fn parse_method(&self, method: &str) -> GatewayResult<HttpMethod> {
        match method.to_uppercase().as_str() {
            "GET" => Ok(HttpMethod::GET),
            "POST" => Ok(HttpMethod::POST),
            "PUT" => Ok(HttpMethod::PUT),
            "DELETE" => Ok(HttpMethod::DELETE),
            "PATCH" => Ok(HttpMethod::PATCH),
            "HEAD" => Ok(HttpMethod::HEAD),
            "OPTIONS" => Ok(HttpMethod::OPTIONS),
            _ => Err(GatewayError::Routing(format!("Unknown method: {}", method))),
        }
    }

    /// Insert route into the tree
    fn insert_route(&mut self, node: &mut RouteNode, path: &str, route_id: &str) -> GatewayResult<()> {
        let segments: Vec<&str> = path.trim_start_matches('/').split('/').collect();

        let mut current = node;
        for segment in segments {
            if segment.is_empty() {
                continue;
            }

            let child_key = if segment.starts_with('{') && segment.ends_with('}') {
                // Parameter segment like {id}
                let param_name = &segment[1..segment.len() - 1];
                if current.param_child.is_none() {
                    current.param_child = Some(Box::new(RouteNode::new()));
                }
                let child = current.param_child.as_mut().unwrap();
                child.is_param = true;
                child.param_name = Some(param_name.to_string());
                format!("{{{}}}", param_name)
            } else if segment == "*" {
                // Wildcard segment
                if current.wildcard_child.is_none() {
                    current.wildcard_child = Some(Box::new(RouteNode::new()));
                }
                let child = current.wildcard_child.as_mut().unwrap();
                child.is_wildcard = true;
                "*".to_string()
            } else {
                // Static segment
                segment.to_string()
            };

            current = if child_key.starts_with('{') {
                current.param_child.as_mut().unwrap()
            } else if child_key == "*" {
                current.wildcard_child.as_mut().unwrap()
            } else {
                current.children.entry(child_key).or_insert_with(RouteNode::new)
            };
        }

        current.route_id = Some(route_id.to_string());
        Ok(())
    }

    /// Find route in the tree
    fn find_route(&self, node: &RouteNode, path: &str) -> GatewayResult<(String, HashMap<String, String>)> {
        let segments: Vec<&str> = path.trim_start_matches('/').split('/').collect();
        let mut params = HashMap::new();

        let mut current = node;
        for segment in segments {
            if segment.is_empty() {
                continue;
            }

            // Try exact match first
            if let Some(child) = current.children.get(segment) {
                current = child;
                continue;
            }

            // Try parameter match
            if let Some(ref param_child) = current.param_child {
                if let Some(ref param_name) = param_child.param_name {
                    params.insert(param_name.clone(), segment.to_string());
                }
                current = param_child;
                continue;
            }

            // Try wildcard match
            if let Some(ref wildcard_child) = current.wildcard_child {
                current = wildcard_child;
                continue;
            }

            return Err(GatewayError::Routing(format!("No route found for path: {}", path)));
        }

        if let Some(ref route_id) = current.route_id {
            Ok((route_id.clone(), params))
        } else {
            Err(GatewayError::Routing(format!("No route found for path: {}", path)))
        }
    }

    /// Remove route from tree (simplified implementation)
    fn remove_route_from_tree(&mut self, _node: &mut RouteNode, _path: &str) {
        // TODO: Implement proper route removal
        // For now, we just leave the tree as is since route removal is rare
    }
}

impl RouteNode {
    fn new() -> Self {
        Self {
            children: HashMap::new(),
            param_child: None,
            wildcard_child: None,
            route_id: None,
            is_param: false,
            param_name: None,
            is_wildcard: false,
        }
    }
}

impl Default for Router {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::BackendConfig;

    fn create_test_route(id: &str, path: &str, methods: Vec<&str>) -> RouteConfig {
        RouteConfig {
            id: id.to_string(),
            path: path.to_string(),
            methods: methods.into_iter().map(|s| s.to_string()).collect(),
            backend: BackendConfig {
                name: "test-backend".to_string(),
                url: "http://localhost:3000".to_string(),
                timeout: 30,
                retry_count: 3,
                health_check: None,
                weight: 1,
            },
            middlewares: vec![],
            priority: 0,
            enabled: true,
        }
    }

    #[test]
    fn test_router_basic() {
        let mut router = Router::new();

        let route = create_test_route("test", "/api/v1/users", vec!["GET"]);
        router.add_route(route).unwrap();

        let request = HttpRequest {
            method: HttpMethod::GET,
            path: "/api/v1/users".to_string(),
            query: HashMap::new(),
            headers: HashMap::new(),
            body: None,
            remote_addr: None,
            request_id: "test".to_string(),
            timestamp: 0,
        };

        let route_match = router.match_route(&request).unwrap();
        assert_eq!(route_match.route_id, "test");
        assert_eq!(route_match.backend.name, "test-backend");
    }

    #[test]
    fn test_router_with_params() {
        let mut router = Router::new();

        let route = create_test_route("user", "/api/v1/users/{id}", vec!["GET"]);
        router.add_route(route).unwrap();

        let request = HttpRequest {
            method: HttpMethod::GET,
            path: "/api/v1/users/123".to_string(),
            query: HashMap::new(),
            headers: HashMap::new(),
            body: None,
            remote_addr: None,
            request_id: "test".to_string(),
            timestamp: 0,
        };

        let route_match = router.match_route(&request).unwrap();
        assert_eq!(route_match.route_id, "user");
        assert_eq!(route_match.path_params.get("id"), Some(&"123".to_string()));
    }

    #[test]
    fn test_router_not_found() {
        let router = Router::new();

        let request = HttpRequest {
            method: HttpMethod::GET,
            path: "/nonexistent".to_string(),
            query: HashMap::new(),
            headers: HashMap::new(),
            body: None,
            remote_addr: None,
            request_id: "test".to_string(),
            timestamp: 0,
        };

        let result = router.match_route(&request);
        assert!(result.is_err());
    }
}
