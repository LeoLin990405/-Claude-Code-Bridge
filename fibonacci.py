"""斐波那契数列实现 - 使用递归+缓存优化"""

from functools import lru_cache


@lru_cache(maxsize=None)
def fibonacci(n: int) -> int:
    """
    计算斐波那契数列的第 n 项。
    
    使用递归 + LRU 缓存优化，时间复杂度 O(n)，空间复杂度 O(n)。
    
    Args:
        n: 斐波那契数列的索引，必须是非负整数
        
    Returns:
        斐波那契数列的第 n 项
        
    Raises:
        ValueError: 如果 n 为负数
        TypeError: 如果 n 不是整数
        
    Examples:
        >>> fibonacci(0)
        0
        >>> fibonacci(10)
        55
        >>> fibonacci(50)
        12586269025
    """
    if not isinstance(n, int):
        raise TypeError(f"n must be an integer, got {type(n).__name__}")
    if n < 0:
        raise ValueError(f"n must be a non-negative integer, got {n}")
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)


def main() -> None:
    """测试用例"""
    # 基础测试用例
    test_cases = [
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
    ]
    
    print("=" * 50)
    print("斐波那契数列测试")
    print("=" * 50)
    
    all_passed = True
    for n, expected in test_cases:
        result = fibonacci(n)
        status = "✓ PASS" if result == expected else "✗ FAIL"
        if result != expected:
            all_passed = False
        print(f"{status} | fibonacci({n:2d}) = {result:>12,} (期望: {expected:>12,})")
    
    # 测试异常处理
    print("\n" + "=" * 50)
    print("异常处理测试")
    print("=" * 50)
    
    try:
        fibonacci(-1)
        print("✗ FAIL | fibonacci(-1) 应该抛出 ValueError")
        all_passed = False
    except ValueError as e:
        print(f"✓ PASS | fibonacci(-1) 正确抛出 ValueError: {e}")
    
    try:
        fibonacci(3.5)
        print("✗ FAIL | fibonacci(3.5) 应该抛出 TypeError")
        all_passed = False
    except TypeError as e:
        print(f"✓ PASS | fibonacci(3.5) 正确抛出 TypeError: {e}")
    
    try:
        fibonacci("10")
        print("✗ FAIL | fibonacci('10') 应该抛出 TypeError")
        all_passed = False
    except TypeError as e:
        print(f"✓ PASS | fibonacci('10') 正确抛出 TypeError: {e}")
    
    # 性能测试（展示缓存效果）
    print("\n" + "=" * 50)
    print("性能测试 - 计算 fibonacci(100)")
    print("=" * 50)
    
    import time
    
    # 清除缓存重新计算
    fibonacci.cache_clear()
    
    start = time.perf_counter()
    result_100 = fibonacci(100)
    elapsed = time.perf_counter() - start
    
    print(f"fibonacci(100) = {result_100}")
    print(f"首次计算耗时: {elapsed * 1000:.4f} ms")
    
    # 再次计算（从缓存读取）
    start = time.perf_counter()
    result_100_cached = fibonacci(100)
    elapsed_cached = time.perf_counter() - start
    
    print(f"缓存读取耗时: {elapsed_cached * 1000:.6f} ms")
    print(f"缓存命中次数: {fibonacci.cache_info().hits}")
    print(f"缓存未命中次数: {fibonacci.cache_info().misses}")
    
    # 总结
    print("\n" + "=" * 50)
    if all_passed:
        print("🎉 所有测试通过！")
    else:
        print("❌ 部分测试失败")
    print("=" * 50)


if __name__ == "__main__":
    main()
