"""
AST Analyzer for CCB

Provides code structure analysis using tree-sitter.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

# Try to import tree-sitter
try:
    import tree_sitter
    HAS_TREE_SITTER = True
except ImportError:
    HAS_TREE_SITTER = False


@dataclass
class ASTNode:
    """A node in the AST."""
    type: str
    text: str
    start_line: int
    start_column: int
    end_line: int
    end_column: int
    children: List["ASTNode"] = field(default_factory=list)


@dataclass
class FunctionInfo:
    """Information about a function."""
    name: str
    file: str
    start_line: int
    end_line: int
    parameters: List[str] = field(default_factory=list)
    return_type: Optional[str] = None
    docstring: Optional[str] = None
    is_async: bool = False
    is_method: bool = False
    class_name: Optional[str] = None


@dataclass
class ClassInfo:
    """Information about a class."""
    name: str
    file: str
    start_line: int
    end_line: int
    bases: List[str] = field(default_factory=list)
    methods: List[str] = field(default_factory=list)
    docstring: Optional[str] = None


@dataclass
class ImportInfo:
    """Information about an import."""
    module: str
    names: List[str] = field(default_factory=list)
    alias: Optional[str] = None
    is_from: bool = False
    line: int = 0


class ASTAnalyzer:
    """
    AST analyzer using tree-sitter.

    Provides code structure analysis:
    - Parse files into AST
    - Find functions and classes
    - Analyze imports
    - Extract code structure
    """

    # Language to tree-sitter language mapping
    LANGUAGE_MAP: Dict[str, str] = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "tsx",
        ".go": "go",
        ".rs": "rust",
        ".java": "java",
        ".c": "c",
        ".cpp": "cpp",
        ".h": "c",
        ".hpp": "cpp",
    }

    def __init__(self):
        """Initialize the AST analyzer."""
        self._parsers: Dict[str, Any] = {}
        self._languages: Dict[str, Any] = {}

        if not HAS_TREE_SITTER:
            print("Warning: tree-sitter not installed. AST analysis will be limited.")

    def _get_parser(self, language: str) -> Optional[Any]:
        """Get or create a parser for a language."""
        if not HAS_TREE_SITTER:
            return None

        if language in self._parsers:
            return self._parsers[language]

        try:
            # Try to load the language
            lang_module = __import__(f"tree_sitter_{language}")
            lang = lang_module.language()

            parser = tree_sitter.Parser(lang)
            self._parsers[language] = parser
            self._languages[language] = lang

            return parser

        except ImportError:
            print(f"Warning: tree-sitter-{language} not installed")
            return None
        except Exception as e:
            print(f"Warning: Failed to load tree-sitter for {language}: {e}")
            return None

    def _get_language_from_file(self, file_path: str) -> Optional[str]:
        """Get the language from file extension."""
        ext = Path(file_path).suffix.lower()
        return self.LANGUAGE_MAP.get(ext)

    def parse_file(self, file_path: str) -> Optional[ASTNode]:
        """
        Parse a file into an AST.

        Args:
            file_path: Path to the file

        Returns:
            Root ASTNode or None if parsing failed
        """
        language = self._get_language_from_file(file_path)
        if not language:
            return None

        parser = self._get_parser(language)
        if not parser:
            return None

        try:
            content = Path(file_path).read_bytes()
            tree = parser.parse(content)
            return self._convert_node(tree.root_node, content)
        except Exception as e:
            print(f"Failed to parse {file_path}: {e}")
            return None

    def _convert_node(self, node: Any, source: bytes) -> ASTNode:
        """Convert a tree-sitter node to ASTNode."""
        children = [self._convert_node(child, source) for child in node.children]

        return ASTNode(
            type=node.type,
            text=source[node.start_byte:node.end_byte].decode(errors="replace"),
            start_line=node.start_point[0] + 1,
            start_column=node.start_point[1] + 1,
            end_line=node.end_point[0] + 1,
            end_column=node.end_point[1] + 1,
            children=children,
        )

    def find_functions(self, file_path: str) -> List[FunctionInfo]:
        """
        Find all functions in a file.

        Args:
            file_path: Path to the file

        Returns:
            List of FunctionInfo
        """
        language = self._get_language_from_file(file_path)
        if not language:
            return self._find_functions_fallback(file_path)

        parser = self._get_parser(language)
        if not parser:
            return self._find_functions_fallback(file_path)

        try:
            content = Path(file_path).read_bytes()
            tree = parser.parse(content)

            functions = []
            self._extract_functions(tree.root_node, content, file_path, functions, language)
            return functions

        except Exception as e:
            print(f"Failed to analyze {file_path}: {e}")
            return self._find_functions_fallback(file_path)

    def _extract_functions(
        self,
        node: Any,
        source: bytes,
        file_path: str,
        functions: List[FunctionInfo],
        language: str,
        class_name: Optional[str] = None,
    ) -> None:
        """Extract functions from AST nodes."""
        # Python function definitions
        if language == "python":
            if node.type == "function_definition":
                func = self._parse_python_function(node, source, file_path, class_name)
                if func:
                    functions.append(func)

            elif node.type == "class_definition":
                # Get class name
                for child in node.children:
                    if child.type == "identifier":
                        class_name = source[child.start_byte:child.end_byte].decode()
                        break

        # JavaScript/TypeScript function definitions
        elif language in ("javascript", "typescript", "tsx"):
            if node.type in ("function_declaration", "method_definition", "arrow_function"):
                func = self._parse_js_function(node, source, file_path, class_name)
                if func:
                    functions.append(func)

            elif node.type == "class_declaration":
                for child in node.children:
                    if child.type == "identifier":
                        class_name = source[child.start_byte:child.end_byte].decode()
                        break

        # Recurse into children
        for child in node.children:
            self._extract_functions(child, source, file_path, functions, language, class_name)

    def _parse_python_function(
        self,
        node: Any,
        source: bytes,
        file_path: str,
        class_name: Optional[str],
    ) -> Optional[FunctionInfo]:
        """Parse a Python function definition."""
        name = None
        parameters = []
        is_async = False
        docstring = None

        for child in node.children:
            if child.type == "identifier":
                name = source[child.start_byte:child.end_byte].decode()
            elif child.type == "parameters":
                for param in child.children:
                    if param.type == "identifier":
                        parameters.append(source[param.start_byte:param.end_byte].decode())
                    elif param.type in ("typed_parameter", "default_parameter"):
                        for p in param.children:
                            if p.type == "identifier":
                                parameters.append(source[p.start_byte:p.end_byte].decode())
                                break
            elif child.type == "block":
                # Check for docstring
                for stmt in child.children:
                    if stmt.type == "expression_statement":
                        for expr in stmt.children:
                            if expr.type == "string":
                                docstring = source[expr.start_byte:expr.end_byte].decode()
                                break
                        break

        # Check for async
        parent = node.parent
        if parent and parent.type == "decorated_definition":
            for child in parent.children:
                if child.type == "decorator":
                    text = source[child.start_byte:child.end_byte].decode()
                    if "async" in text.lower():
                        is_async = True

        if not name:
            return None

        return FunctionInfo(
            name=name,
            file=file_path,
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            parameters=parameters,
            docstring=docstring,
            is_async=is_async,
            is_method=class_name is not None,
            class_name=class_name,
        )

    def _parse_js_function(
        self,
        node: Any,
        source: bytes,
        file_path: str,
        class_name: Optional[str],
    ) -> Optional[FunctionInfo]:
        """Parse a JavaScript/TypeScript function."""
        name = None
        parameters = []
        is_async = False

        for child in node.children:
            if child.type == "identifier":
                name = source[child.start_byte:child.end_byte].decode()
            elif child.type == "property_identifier":
                name = source[child.start_byte:child.end_byte].decode()
            elif child.type == "formal_parameters":
                for param in child.children:
                    if param.type == "identifier":
                        parameters.append(source[param.start_byte:param.end_byte].decode())
                    elif param.type == "required_parameter":
                        for p in param.children:
                            if p.type == "identifier":
                                parameters.append(source[p.start_byte:p.end_byte].decode())
                                break

        # Check for async keyword
        text = source[node.start_byte:node.end_byte].decode()
        if text.startswith("async"):
            is_async = True

        if not name:
            return None

        return FunctionInfo(
            name=name,
            file=file_path,
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            parameters=parameters,
            is_async=is_async,
            is_method=class_name is not None,
            class_name=class_name,
        )

    def _find_functions_fallback(self, file_path: str) -> List[FunctionInfo]:
        """Fallback function finder using regex."""
        import re

        functions = []
        try:
            content = Path(file_path).read_text()
            lines = content.split("\n")

            # Python pattern
            py_pattern = re.compile(r"^\s*(async\s+)?def\s+(\w+)\s*\(")
            # JS/TS pattern
            js_pattern = re.compile(r"^\s*(async\s+)?function\s+(\w+)\s*\(|^\s*(\w+)\s*[=:]\s*(async\s+)?\(")

            for i, line in enumerate(lines):
                # Python
                match = py_pattern.match(line)
                if match:
                    is_async = match.group(1) is not None
                    name = match.group(2)
                    functions.append(FunctionInfo(
                        name=name,
                        file=file_path,
                        start_line=i + 1,
                        end_line=i + 1,
                        is_async=is_async,
                    ))
                    continue

                # JavaScript
                match = js_pattern.match(line)
                if match:
                    is_async = match.group(1) is not None or match.group(4) is not None
                    name = match.group(2) or match.group(3)
                    if name:
                        functions.append(FunctionInfo(
                            name=name,
                            file=file_path,
                            start_line=i + 1,
                            end_line=i + 1,
                            is_async=is_async,
                        ))

        except Exception:
            pass

        return functions

    def find_classes(self, file_path: str) -> List[ClassInfo]:
        """
        Find all classes in a file.

        Args:
            file_path: Path to the file

        Returns:
            List of ClassInfo
        """
        language = self._get_language_from_file(file_path)
        if not language:
            return self._find_classes_fallback(file_path)

        parser = self._get_parser(language)
        if not parser:
            return self._find_classes_fallback(file_path)

        try:
            content = Path(file_path).read_bytes()
            tree = parser.parse(content)

            classes = []
            self._extract_classes(tree.root_node, content, file_path, classes, language)
            return classes

        except Exception as e:
            print(f"Failed to analyze {file_path}: {e}")
            return self._find_classes_fallback(file_path)

    def _extract_classes(
        self,
        node: Any,
        source: bytes,
        file_path: str,
        classes: List[ClassInfo],
        language: str,
    ) -> None:
        """Extract classes from AST nodes."""
        if language == "python" and node.type == "class_definition":
            cls = self._parse_python_class(node, source, file_path)
            if cls:
                classes.append(cls)

        elif language in ("javascript", "typescript", "tsx") and node.type == "class_declaration":
            cls = self._parse_js_class(node, source, file_path)
            if cls:
                classes.append(cls)

        for child in node.children:
            self._extract_classes(child, source, file_path, classes, language)

    def _parse_python_class(
        self,
        node: Any,
        source: bytes,
        file_path: str,
    ) -> Optional[ClassInfo]:
        """Parse a Python class definition."""
        name = None
        bases = []
        methods = []
        docstring = None

        for child in node.children:
            if child.type == "identifier":
                name = source[child.start_byte:child.end_byte].decode()
            elif child.type == "argument_list":
                for arg in child.children:
                    if arg.type == "identifier":
                        bases.append(source[arg.start_byte:arg.end_byte].decode())
            elif child.type == "block":
                for stmt in child.children:
                    if stmt.type == "function_definition":
                        for c in stmt.children:
                            if c.type == "identifier":
                                methods.append(source[c.start_byte:c.end_byte].decode())
                                break
                    elif stmt.type == "expression_statement" and not docstring:
                        for expr in stmt.children:
                            if expr.type == "string":
                                docstring = source[expr.start_byte:expr.end_byte].decode()
                                break

        if not name:
            return None

        return ClassInfo(
            name=name,
            file=file_path,
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            bases=bases,
            methods=methods,
            docstring=docstring,
        )

    def _parse_js_class(
        self,
        node: Any,
        source: bytes,
        file_path: str,
    ) -> Optional[ClassInfo]:
        """Parse a JavaScript/TypeScript class."""
        name = None
        bases = []
        methods = []

        for child in node.children:
            if child.type == "identifier":
                name = source[child.start_byte:child.end_byte].decode()
            elif child.type == "class_heritage":
                for c in child.children:
                    if c.type == "identifier":
                        bases.append(source[c.start_byte:c.end_byte].decode())
            elif child.type == "class_body":
                for member in child.children:
                    if member.type == "method_definition":
                        for c in member.children:
                            if c.type == "property_identifier":
                                methods.append(source[c.start_byte:c.end_byte].decode())
                                break

        if not name:
            return None

        return ClassInfo(
            name=name,
            file=file_path,
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            bases=bases,
            methods=methods,
        )

    def _find_classes_fallback(self, file_path: str) -> List[ClassInfo]:
        """Fallback class finder using regex."""
        import re

        classes = []
        try:
            content = Path(file_path).read_text()
            lines = content.split("\n")

            # Python pattern
            py_pattern = re.compile(r"^\s*class\s+(\w+)")
            # JS/TS pattern
            js_pattern = re.compile(r"^\s*class\s+(\w+)")

            for i, line in enumerate(lines):
                match = py_pattern.match(line) or js_pattern.match(line)
                if match:
                    name = match.group(1)
                    classes.append(ClassInfo(
                        name=name,
                        file=file_path,
                        start_line=i + 1,
                        end_line=i + 1,
                    ))

        except Exception:
            pass

        return classes

    def get_imports(self, file_path: str) -> List[ImportInfo]:
        """
        Get all imports in a file.

        Args:
            file_path: Path to the file

        Returns:
            List of ImportInfo
        """
        imports = []
        try:
            content = Path(file_path).read_text()
            lines = content.split("\n")

            import re

            # Python imports
            py_import = re.compile(r"^\s*import\s+(\S+)(?:\s+as\s+(\w+))?")
            py_from = re.compile(r"^\s*from\s+(\S+)\s+import\s+(.+)")

            # JS/TS imports
            js_import = re.compile(r"^\s*import\s+(?:{([^}]+)}|(\w+))\s+from\s+['\"]([^'\"]+)['\"]")

            for i, line in enumerate(lines):
                # Python import
                match = py_import.match(line)
                if match:
                    imports.append(ImportInfo(
                        module=match.group(1),
                        alias=match.group(2),
                        line=i + 1,
                    ))
                    continue

                # Python from import
                match = py_from.match(line)
                if match:
                    module = match.group(1)
                    names = [n.strip() for n in match.group(2).split(",")]
                    imports.append(ImportInfo(
                        module=module,
                        names=names,
                        is_from=True,
                        line=i + 1,
                    ))
                    continue

                # JS/TS import
                match = js_import.match(line)
                if match:
                    names = []
                    if match.group(1):
                        names = [n.strip() for n in match.group(1).split(",")]
                    elif match.group(2):
                        names = [match.group(2)]
                    imports.append(ImportInfo(
                        module=match.group(3),
                        names=names,
                        is_from=True,
                        line=i + 1,
                    ))

        except Exception:
            pass

        return imports


# Singleton instance
_ast_analyzer: Optional[ASTAnalyzer] = None


def get_ast_analyzer() -> ASTAnalyzer:
    """Get the global AST analyzer instance."""
    global _ast_analyzer
    if _ast_analyzer is None:
        _ast_analyzer = ASTAnalyzer()
    return _ast_analyzer
