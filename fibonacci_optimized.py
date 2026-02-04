"""
斐波那契数列实现 - 使用递归+缓存优化（带类型注解和测试用例）
"""

from functools import lru_cache
from typing import Dict, Optional
import unittest
import time
import sys


@lru_cache(maxsize=None)
def fibonacci_lru(n: int) -> int:
    """
    计算斐波那契数列的第 n 项，使用递归 + LRU 缓存优化。
    
    Args:
        n: 斐波那契数列的索引，必须是非负整数
        
    Returns:
        斐波那契数列的第 n 项
        
    Raises:
        ValueError: 如果 n 为负数
        TypeError: 如果 n 不是整数
        
    Examples:
        >>> fibonacci_lru(0)
        0
        >>> fibonacci_lru(10)
        55
    """
    if not isinstance(n, int):
        raise TypeError(f"n must be an integer, got {type(n).__name__}")
    if n < 0:
        raise ValueError(f"n must be a non-negative integer, got {n}")
    if n < 2:
        return n
    return fibonacci_lru(n - 1) + fibonacci_lru(n - 2)


def fibonacci_memo(n: int, memo: Optional[Dict[int, int]] = None) -> int:
    """
    计算斐波那契数列的第 n 项，使用递归 + 手动备忘录缓存优化。
    
    Args:
        n: 斐波那契数列的索引，必须是非负整数
        memo: 可选的备忘录字典，用于缓存计算结果
        
    Returns:
        斐波那契数列的第 n 项
    """
    if not isinstance(n, int):
        raise TypeError(f"n must be an integer, got {type(n).__name__}")
    if n < 0:
        raise ValueError(f"n must be a non-negative integer, got {n}")
    
    if memo is None:
        memo = {}
    
    if n in memo:
        return memo[n]
    
    if n < 2:
        result = n
    else:
        result = fibonacci_memo(n - 1, memo) + fibonacci_memo(n - 2, memo)
    
    memo[n] = result
    return result


def fibonacci_iterative(n: int) -> int:
    """
    计算斐波那契数列的第 n 项，使用迭代方法（对比实现）。
    
    Args:
        n: 斐波那契数列的索引，必须是非负整数
        
    Returns:
        斐波那契数列的第 n 项
    """
    if not isinstance(n, int):
        raise TypeError(f"n must be an integer, got {type(n).__name__}")
    if n < 0:
        raise ValueError(f"n must be a non-negative integer, got {n}")
    
    if n < 2:
        return n
    
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b


class TestFibonacci(unittest.TestCase):
    """测试斐波那契数列函数"""
    
    def setUp(self) -> None:
        """测试前的准备工作"""
        self.test_cases = [
            (0, 0),
            (1, 1),
            (2, 1),
            (3, 2),
            (4, 3),
            (5, 5),
            (6, 8),
            (7, 13),
            (10, 55),
            (20, 6765),
            (30, 832040),
            (50, 12586269025),
            (70, 190392490709135),
            (100, 354224848179261915075),
        ]
    
    def test_fibonacci_lru_basic(self) -> None:
        """测试 fibonacci_lru 函数的基础功能"""
        for n, expected in self.test_cases:
            with self.subTest(n=n):
                result = fibonacci_lru(n)
                self.assertEqual(result, expected, f"fibonacci_lru({n}) = {result}, expected {expected}")
    
    def test_fibonacci_memo_basic(self) -> None:
        """测试 fibonacci_memo 函数的基础功能"""
        for n, expected in self.test_cases:
            with self.subTest(n=n):
                result = fibonacci_memo(n)
                self.assertEqual(result, expected, f"fibonacci_memo({n}) = {result}, expected {expected}")
    
    def test_fibonacci_iterative_basic(self) -> None:
        """测试 fibonacci_iterative 函数的基础功能"""
        for n, expected in self.test_cases:
            with self.subTest(n=n):
                result = fibonacci_iterative(n)
                self.assertEqual(result, expected, f"fibonacci_iterative({n}) = {result}, expected {expected}")
    
    def test_consistency_between_methods(self) -> None:
        """测试三种方法的结果一致性"""
        for n, _ in self.test_cases[:15]:  # 测试前15个用例，避免递归深度问题
            with self.subTest(n=n):
                result_lru = fibonacci_lru(n)
                result_memo = fibonacci_memo(n)
                result_iter = fibonacci_iterative(n)
                self.assertEqual(result_lru, result_memo, f"LRU和备忘录方法在n={n}时结果不一致")
                self.assertEqual(result_lru, result_iter, f"LRU和迭代方法在n={n}时结果不一致")
    
    def test_error_handling(self) -> None:
        """测试错误处理"""
        # 测试负数输入
        with self.assertRaises(ValueError) as context:
            fibonacci_lru(-1)
        self.assertIn("must be a non-negative integer", str(context.exception))
        
        with self.assertRaises(ValueError) as context:
            fibonacci_memo(-1)
        self.assertIn("must be a non-negative integer", str(context.exception))
        
        # 测试非整数输入
        with self.assertRaises(TypeError) as context:
            fibonacci_lru(3.5)
        self.assertIn("must be an integer", str(context.exception))
        
        with self.assertRaises(TypeError) as context:
            fibonacci_memo("10")
        self.assertIn("must be an integer", str(context.exception))
    
    def test_performance(self) -> None:
        """测试缓存性能"""
        # 清除LRU缓存
        fibonacci_lru.cache_clear()
        
        # 第一次计算
        start = time.perf_counter()
        result_100_lru = fibonacci_lru(100)
        time_first_lru = time.perf_counter() - start
        
        # 第二次计算（应该从缓存读取）
        start = time.perf_counter()
        result_100_lru_cached = fibonacci_lru(100)
        time_cached_lru = time.perf_counter() - start
        
        self.assertEqual(result_100_lru, result_100_lru_cached)
        self.assertLess(time_cached_lru, time_first_lru, "缓存读取应该比首次计算快")
        
        # 检查缓存信息
        cache_info = fibonacci_lru.cache_info()
        self.assertGreater(cache_info.hits, 0, "应该有缓存命中")
        self.assertGreater(cache_info.misses, 0, "应该有缓存未命中")
        
        print(f"\n性能测试结果:")
        print(f"  LRU缓存首次计算 fibonacci(100): {time_first_lru * 1000:.4f} ms")
        print(f"  LRU缓存读取 fibonacci(100): {time_cached_lru * 1000:.6f} ms")
        print(f"  缓存命中次数: {cache_info.hits}")
        print(f"  缓存未命中次数: {cache_info.misses}")
    
    def test_memo_reuse(self) -> None:
        """测试备忘录字典的重用"""
        memo = {}
        result1 = fibonacci_memo(10, memo)
        result2 = fibonacci_memo(20, memo)  # 重用同一个备忘录
        result3 = fibonacci_memo(10, memo)  # 应该从备忘录读取
        
        self.assertEqual(result1, 55)
        self.assertEqual(result2, 6765)
        self.assertEqual(result3, 55)
        self.assertIn(10, memo)
        self.assertIn(20, memo)


def benchmark() -> None:
    """性能基准测试"""
    print("=" * 60)
    print("斐波那契数列性能基准测试")
    print("=" * 60)
    
    test_n = 35  # 足够大以展示差异，但又不会导致递归深度问题
    
    # LRU缓存方法
    fibonacci_lru.cache_clear()
    start = time.perf_counter()
    result_lru = fibonacci_lru(test_n)
    time_lru = time.perf_counter() - start
    
    # 备忘录方法
    start = time.perf_counter()
    result_memo = fibonacci_memo(test_n)
    time_memo = time.perf_counter() - start
    
    # 迭代方法
    start = time.perf_counter()
    result_iter = fibonacci_iterative(test_n)
    time_iter = time.perf_counter() - start
    
    print(f"计算 fibonacci({test_n}) = {result_lru}")
    print(f"\n方法比较:")
    print(f"  LRU缓存方法: {time_lru * 1000:.4f} ms")
    print(f"  备忘录方法: {time_memo * 1000:.4f} ms")
    print(f"  迭代方法: {time_iter * 1000:.4f} ms")
    print(f"\n缓存信息:")
    print(f"  LRU缓存命中: {fibonacci_lru.cache_info().hits}")
    print(f"  LRU缓存未命中: {fibonacci_lru.cache_info().misses}")
    
    # 验证结果一致性
    assert result_lru == result_memo == result_iter, "所有方法的结果应该一致"


def main() -> None:
    """运行示例和测试"""
    print("斐波那契数列示例")
    print("=" * 40)
    
    # 示例使用
    examples = [0, 1, 2, 3, 5, 10, 20, 30]
    for n in examples:
        result = fibonacci_lru(n)
        print(f"fibonacci({n:2d}) = {result:>10,}")
    
    print("\n" + "=" * 40)
    print("运行单元测试...")
    
    # 运行单元测试
    suite = unittest.TestLoader().loadTestsFromTestCase(TestFibonacci)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    print("\n" + "=" * 40)
    if result.wasSuccessful():
        print("✅ 所有测试通过！")
        # 运行性能基准测试
        benchmark()
    else:
        print("❌ 测试失败")


if __name__ == "__main__":
    # 直接运行示例
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        unittest.main(argv=[sys.argv[0]])
    else:
        main()